/**
 * Acceptance test for the correlation engine.
 *
 * Run with: npm run engine:test
 *
 * The bar is not "produces flags". It is "produces exactly the flags the rigged
 * dataset was built to produce, and stays silent everywhere else". A detector
 * that flags everything is worthless, so the false-positive and near-miss
 * checks matter more than the true positives.
 */

import { runEngine } from "../shared/engine.js";
import { buildSeed, EXPECTED_FLAGS, EXPECTED_SILENT, BLOCKS } from "../shared/seed.js";

const AS_OF = process.argv[2] ?? "2026-08-14";

const data = buildSeed(AS_OF);
const started = performance.now();
const flags = runEngine({ ...data, asOf: AS_OF });
const elapsed = performance.now() - started;

const byBlock = new Map(flags.map((f) => [f.block_id, f]));
const failures: string[] = [];

console.log(`\nSeed: ${data.health.length} health, ${data.agri.length} agri, ` +
  `${data.weather.length} weather rows across ${data.blocks.length} blocks, as of ${AS_OF}`);
console.log(`Engine: ${flags.length} flags in ${elapsed.toFixed(1)} ms\n`);

// ---- expected flags --------------------------------------------------------
for (const [blockId, expectedRule] of Object.entries(EXPECTED_FLAGS)) {
  const flag = byBlock.get(blockId);
  const name = BLOCKS.find((b) => b.block_id === blockId)?.name ?? blockId;
  if (!flag) {
    failures.push(`${name} (${blockId}): expected a ${expectedRule} flag, got none`);
  } else if (flag.rule !== expectedRule) {
    failures.push(`${name} (${blockId}): expected ${expectedRule}, got ${flag.rule}`);
  }
}

// ---- near miss must stay silent -------------------------------------------
for (const blockId of EXPECTED_SILENT) {
  const flag = byBlock.get(blockId);
  const name = BLOCKS.find((b) => b.block_id === blockId)?.name ?? blockId;
  if (flag) {
    failures.push(
      `${name} (${blockId}): must stay below threshold, but raised ${flag.rule} ` +
      `(${JSON.stringify(flag.evidence)})`,
    );
  }
}

// ---- no false positives anywhere else -------------------------------------
for (const flag of flags) {
  if (!(flag.block_id in EXPECTED_FLAGS)) {
    failures.push(
      `${flag.block_name} (${flag.block_id}): unexpected ${flag.rule} flag, ` +
      `nothing was rigged here`,
    );
  }
}

// ---- report ----------------------------------------------------------------
for (const f of flags) {
  console.log(
    `  ${f.severity.toUpperCase().padEnd(6)} ${f.rule.padEnd(10)} ` +
    `${f.block_name.padEnd(11)} ${f.window_start} to ${f.window_end}`,
  );
  console.log(`         ${f.explanation}`);
  console.log(`         action: ${f.action}\n`);
}

const silent = BLOCKS.filter((b) => !byBlock.has(b.block_id));
console.log(`Silent blocks (${silent.length}): ${silent.map((b) => b.name).join(", ")}\n`);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} problem${failures.length === 1 ? "" : "s"}`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("PASS: engine flagged exactly the rigged blocks and stayed silent elsewhere.");
