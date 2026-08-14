/**
 * Live weather enrichment via Open-Meteo.
 *
 * Chosen over OpenWeather for three reasons that matter on a deadline:
 *   1. No API key, no signup, no card, no activation lag. Nothing to configure.
 *   2. Free historical data. OpenWeather's free tier serves forecast only, so
 *      the 60-day baseline the engine needs would have stayed synthetic.
 *   3. One request per block covers 60 past days plus a 7 day forecast, which
 *      is the entire window the engine reads.
 *
 * Free for non-commercial use under roughly 10k calls/day. Ten blocks polled
 * once a day is 10. A commercial deployment needs their paid tier; say so
 * rather than assuming the free terms scale.
 *
 * WRITE BEHAVIOUR IS DELIBERATE. A bare GET fetches real data and reports it
 * without touching the database. Persisting requires ?write=1.
 *
 * The reason: the demo scenario's heat run is synthetic and positioned inside
 * the engine's 25-day evaluation window. Real heat in this district peaks in
 * mid-June, which is outside that window for an August evaluation date, so
 * silently overwriting would remove the composite flag and nobody would notice
 * until it was on a projector. Showing real numbers and changing the scenario
 * are different actions and should require different requests.
 */

import { getDb } from "../shared/db.js";
import { listBlocks } from "../shared/repo.js";
import { heatIndexC, THRESHOLDS } from "../shared/engine.js";
import { handle, param, type Req, type Res } from "./_lib.js";

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
  };
}

interface DailyReading {
  for_date: string;
  temp_c: number;
  humidity_pct: number;
  heat_index_c: number;
}

/** Daily maximum temperature with the humidity recorded at that same hour.
 *  Heat stress is driven by the hottest part of the day, not the mean. */
function toDaily(json: OpenMeteoResponse): DailyReading[] {
  const hourly = json.hourly;
  if (!hourly) return [];

  const perDay = new Map<string, { temp: number; rh: number }>();
  hourly.time.forEach((stamp, i) => {
    const temp = hourly.temperature_2m[i];
    const rh = hourly.relative_humidity_2m[i];
    if (temp === null || rh === null) return; // gaps at the forecast edge
    const day = stamp.slice(0, 10);
    const prev = perDay.get(day);
    if (!prev || temp > prev.temp) perDay.set(day, { temp, rh });
  });

  return [...perDay.entries()]
    .map(([for_date, v]) => ({
      for_date,
      temp_c: Math.round(v.temp * 10) / 10,
      humidity_pct: Math.round(v.rh),
      heat_index_c: heatIndexC(v.temp, v.rh),
    }))
    .sort((a, b) => a.for_date.localeCompare(b.for_date));
}

export default handle(async (req: Req, res: Res) => {
  const db = await getDb();
  const write = param(req, "write") === "1";
  const pastDays = Math.min(Number(param(req, "past_days") ?? 60) || 60, 92);

  const blocks = await listBlocks(db);
  if (blocks.length === 0) {
    res.status(200).json({
      live: false,
      reason: "No blocks in the database yet. Run /api/seed first.",
    });
    return;
  }

  const summary: Record<string, unknown>[] = [];
  const failed: { block: string; reason: string }[] = [];
  let written = 0;

  for (const b of blocks) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${b.lat}&longitude=${b.lon}` +
        `&hourly=temperature_2m,relative_humidity_2m` +
        `&past_days=${pastDays}&forecast_days=7&timezone=auto`;

      const r = await fetch(url);
      if (!r.ok) {
        failed.push({ block: b.name, reason: `Open-Meteo ${r.status}` });
        continue;
      }

      const daily = toDaily((await r.json()) as OpenMeteoResponse);
      if (daily.length === 0) {
        failed.push({ block: b.name, reason: "No usable hourly data" });
        continue;
      }

      if (write) {
        for (const d of daily) {
          await db.query(
            `INSERT INTO weather_cache (block_id, for_date, temp_c, humidity_pct, heat_index_c)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (block_id, for_date) DO UPDATE
               SET temp_c = EXCLUDED.temp_c,
                   humidity_pct = EXCLUDED.humidity_pct,
                   heat_index_c = EXCLUDED.heat_index_c,
                   fetched_at = now()`,
            [b.block_id, d.for_date, d.temp_c, d.humidity_pct, d.heat_index_c],
          );
          written++;
        }
      }

      const peak = daily.reduce((m, d) => (d.heat_index_c > m.heat_index_c ? d : m));
      const over = daily.filter((d) => d.heat_index_c >= THRESHOLDS.heatIndexC);

      summary.push({
        block: b.name,
        block_id: b.block_id,
        days: daily.length,
        range: [daily[0].for_date, daily[daily.length - 1].for_date],
        peak_heat_index_c: peak.heat_index_c,
        peak_on: peak.for_date,
        peak_conditions: `${peak.temp_c}C at ${peak.humidity_pct}% humidity`,
        days_over_threshold: over.length,
      });
    } catch (err) {
      failed.push({
        block: b.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    live: true,
    source: "Open-Meteo forecast API, no key required, free for non-commercial use",
    persisted: write,
    rows_written: written,
    threshold_c: THRESHOLDS.heatIndexC,
    note: write
      ? "Weather rows replaced with live data. This can change which heat and composite flags fire, because real weather is not the seeded scenario. Re-run /api/seed to restore the demo scenario."
      : "Read-only. Real figures fetched and reported, database untouched. Add ?write=1 to persist.",
    blocks: summary,
    failed,
  });
});
