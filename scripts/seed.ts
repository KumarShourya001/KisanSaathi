/**
 * Seeds the database and then runs the engine against what actually came back
 * out of it, rather than against the in-memory objects. That round trip is the
 * point: it proves the schema, the date handling and the queries all agree.
 *
 *   npm run db:seed                 seeds local PGlite in ./.pglite
 *   DATABASE_URL=... npm run db:seed  seeds Neon
 */

import { getDb } from "../shared/db.js";
import { ensureSchema, replaceSeed, loadEngineInput, countRows } from "../shared/repo.js";
import { buildSeed, EXPECTED_FLAGS, EXPECTED_SILENT } from "../shared/seed.js";
import { runEngine } from "../shared/engine.js";

const AS_OF = process.env.AS_OF ?? new Date().toISOString().slice(0, 10);

const db = await getDb();
console.log(`\nDriver: ${db.driver}`);

await ensureSchema(db);
console.log("Schema: ok");

const data = buildSeed(AS_OF);
const t0 = performance.now();
await replaceSeed(db, data);
console.log(`Seeded in ${(performance.now() - t0).toFixed(0)} ms`);

const counts = await countRows(db);
console.log("Rows:", counts);

// Round trip: read it back out and run the engine on the database's version.
const input = await loadEngineInput(db, AS_OF);
const flags = runEngine({ ...input, asOf: AS_OF });

console.log(`\nEngine over database rows, as of ${AS_OF}: ${flags.length} flags`);
for (const f of flags) {
  console.log(`  ${f.severity.toUpperCase().padEnd(6)} ${f.rule.padEnd(10)} ${f.block_name}`);
}

const byBlock = new Map(flags.map((f) => [f.block_id, f]));
const problems: string[] = [];
for (const [b, rule] of Object.entries(EXPECTED_FLAGS)) {
  if (byBlock.get(b)?.rule !== rule) problems.push(`${b} expected ${rule}, got ${byBlock.get(b)?.rule ?? "none"}`);
}
for (const b of EXPECTED_SILENT) {
  if (byBlock.has(b)) problems.push(`${b} should be silent, got ${byBlock.get(b)!.rule}`);
}

if (problems.length) {
  console.error("\nFAIL: database round trip changed the engine's answer");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("\nPASS: same answer through the database as in memory.");
process.exit(0);
