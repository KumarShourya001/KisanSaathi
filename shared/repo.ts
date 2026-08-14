/**
 * Every query the app makes, in one file. Shared by the serverless functions
 * and the local scripts so there is exactly one definition of each.
 */

import { asDate, type Db } from "./db.js";
import { SCHEMA_SQL } from "./schema.js";
import type {
  AgriRecord,
  Block,
  HealthRecord,
  SyncOp,
  SyncResult,
  WeatherDay,
} from "./types.js";

export async function ensureSchema(db: Db): Promise<void> {
  await db.exec(SCHEMA_SQL);
}

export async function listBlocks(db: Db): Promise<Block[]> {
  return db.query<Block>(
    `SELECT block_id, name, district, state, lat, lon, households
       FROM blocks ORDER BY name`,
  );
}

export async function countRows(db: Db): Promise<Record<string, number>> {
  const [row] = await db.query<Record<string, string>>(
    `SELECT
       (SELECT count(*) FROM blocks)         AS blocks,
       (SELECT count(*) FROM health_records) AS health,
       (SELECT count(*) FROM agri_records)   AS agri,
       (SELECT count(*) FROM weather_cache)  AS weather,
       (SELECT count(*) FROM sync_ops)       AS ops`,
  );
  return Object.fromEntries(
    Object.entries(row ?? {}).map(([k, v]) => [k, Number(v)]),
  );
}

/** Pulls the window the engine needs. 120 days covers the 60-day baseline
 *  plus the evaluation lookback with room to spare. */
export async function loadEngineInput(
  db: Db,
  asOf: string,
): Promise<{
  blocks: Block[];
  health: HealthRecord[];
  agri: AgriRecord[];
  weather: WeatherDay[];
}> {
  const from = new Date(Date.parse(`${asOf}T00:00:00Z`) - 120 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [blocks, health, agri, weather] = await Promise.all([
    listBlocks(db),
    db.query<HealthRecord>(
      `SELECT op_id, block_id, observed_on, symptom_category, severity,
              age_band, reporter_id
         FROM health_records WHERE observed_on >= $1`,
      [from],
    ),
    db.query<AgriRecord>(
      `SELECT op_id, block_id, applied_on, input_class, crop, area_ha, reporter_id
         FROM agri_records WHERE applied_on >= $1`,
      [from],
    ),
    db.query<WeatherDay>(
      `SELECT block_id, for_date, temp_c, humidity_pct, heat_index_c
         FROM weather_cache WHERE for_date >= $1`,
      [from],
    ),
  ]);

  return {
    blocks,
    health: health.map((h) => ({
      ...h,
      observed_on: asDate(h.observed_on),
      severity: Number(h.severity) as 1 | 2 | 3,
    })),
    agri: agri.map((a) => ({
      ...a,
      applied_on: asDate(a.applied_on),
      area_ha: Number(a.area_ha),
    })),
    weather: weather.map((w) => ({
      ...w,
      for_date: asDate(w.for_date),
      temp_c: Number(w.temp_c),
      humidity_pct: Number(w.humidity_pct),
      heat_index_c: Number(w.heat_index_c),
    })),
  };
}

// ------------------------------------------------------------------- sync

/**
 * Idempotent by construction. ON CONFLICT DO NOTHING against the device-issued
 * op_id means a retried batch, a duplicated batch, or a batch that half
 * succeeded before the connection dropped all converge on the same state.
 *
 * The RETURNING clause is what distinguishes "inserted" from "already had it",
 * so the client can show an honest per-op result instead of a blanket success.
 */
export async function applyOps(db: Db, ops: SyncOp[]): Promise<SyncResult> {
  const result: SyncResult = { accepted: [], duplicates: [], rejected: [] };

  for (const op of ops) {
    try {
      let inserted: { op_id: string }[] = [];

      if (op.kind === "health") {
        const p = op.payload as unknown as HealthRecord;
        inserted = await db.query<{ op_id: string }>(
          `INSERT INTO health_records
             (op_id, block_id, observed_on, symptom_category, severity,
              age_band, reporter_id, device_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (op_id) DO NOTHING
           RETURNING op_id`,
          [
            op.op_id,
            op.block_id,
            p.observed_on,
            p.symptom_category,
            p.severity,
            p.age_band,
            p.reporter_id,
            op.device_id,
          ],
        );
      } else if (op.kind === "agri") {
        const p = op.payload as unknown as AgriRecord;
        inserted = await db.query<{ op_id: string }>(
          `INSERT INTO agri_records
             (op_id, block_id, applied_on, input_class, crop, area_ha,
              reporter_id, device_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (op_id) DO NOTHING
           RETURNING op_id`,
          [
            op.op_id,
            op.block_id,
            p.applied_on,
            p.input_class,
            p.crop,
            p.area_ha,
            p.reporter_id,
            op.device_id,
          ],
        );
      } else {
        result.rejected.push({ op_id: op.op_id, reason: "unknown kind" });
        continue;
      }

      const outcome = inserted.length > 0 ? "accepted" : "duplicate";
      if (outcome === "accepted") result.accepted.push(op.op_id);
      else result.duplicates.push(op.op_id);

      await db.query(
        `INSERT INTO sync_ops (op_id, kind, device_id, seq, outcome)
         VALUES ($1,$2,$3,$4,$5)`,
        [op.op_id, op.kind, op.device_id, op.seq, outcome],
      );
    } catch (err) {
      result.rejected.push({
        op_id: op.op_id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

// ------------------------------------------------------------------ seeding

/**
 * Multi-row INSERT in chunks. Seeding is roughly 700 rows, and over the Neon
 * HTTP endpoint one row per request would be 700 round trips. Chunking to 80
 * rows turns that into single figures.
 */
async function insertMany(
  db: Db,
  table: string,
  columns: string[],
  rows: unknown[][],
  onConflict: string,
  chunkSize = 80,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(",")})
       VALUES ${tuples.join(",")} ${onConflict}`,
      params,
    );
  }
}

export async function replaceSeed(
  db: Db,
  data: {
    blocks: Block[];
    health: HealthRecord[];
    agri: AgriRecord[];
    weather: WeatherDay[];
  },
): Promise<void> {
  // Order matters: the record tables reference blocks.
  for (const t of ["sync_ops", "health_records", "agri_records", "weather_cache", "consents", "blocks"]) {
    await db.query(`DELETE FROM ${t}`);
  }

  await insertMany(
    db,
    "blocks",
    ["block_id", "name", "district", "state", "lat", "lon", "households"],
    data.blocks.map((b) => [b.block_id, b.name, b.district, b.state, b.lat, b.lon, b.households]),
    "ON CONFLICT (block_id) DO NOTHING",
  );

  await insertMany(
    db,
    "health_records",
    ["op_id", "block_id", "observed_on", "symptom_category", "severity", "age_band", "reporter_id"],
    data.health.map((h) => [h.op_id, h.block_id, h.observed_on, h.symptom_category, h.severity, h.age_band, h.reporter_id]),
    "ON CONFLICT (op_id) DO NOTHING",
  );

  await insertMany(
    db,
    "agri_records",
    ["op_id", "block_id", "applied_on", "input_class", "crop", "area_ha", "reporter_id"],
    data.agri.map((a) => [a.op_id, a.block_id, a.applied_on, a.input_class, a.crop, a.area_ha, a.reporter_id]),
    "ON CONFLICT (op_id) DO NOTHING",
  );

  await insertMany(
    db,
    "weather_cache",
    ["block_id", "for_date", "temp_c", "humidity_pct", "heat_index_c"],
    data.weather.map((w) => [w.block_id, w.for_date, w.temp_c, w.humidity_pct, w.heat_index_c]),
    "ON CONFLICT (block_id, for_date) DO NOTHING",
  );
}
