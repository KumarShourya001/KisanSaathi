/**
 * Runs the correlation engine over the current database contents.
 *
 * Computed per request rather than from a stored table. At 10 blocks and ~700
 * records the whole run is under 5 ms, and computing live means a record that
 * synced 3 seconds ago moves a flag immediately, which is the thing the demo
 * needs to show.
 */

import { getDb } from "../shared/db.js";
import { loadEngineInput } from "../shared/repo.js";
import { runEngine, THRESHOLDS } from "../shared/engine.js";
import { handle, methodNotAllowed, param, today, type Req, type Res } from "./_lib.js";

export default handle(async (req: Req, res: Res) => {
  if (req.method && req.method !== "GET") return methodNotAllowed(res, "GET");

  const asOf = param(req, "as_of") ?? today();
  const db = await getDb();

  const started = Date.now();
  const input = await loadEngineInput(db, asOf);
  const flags = runEngine({ ...input, asOf });
  const elapsed = Date.now() - started;

  const flagged = new Set(flags.map((f) => f.block_id));
  const quiet = input.blocks
    .filter((b) => !flagged.has(b.block_id))
    .map((b) => ({ block_id: b.block_id, name: b.name }));

  res.setHeader("Server-Timing", `engine;dur=${elapsed}`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    as_of: asOf,
    flags,
    quiet_blocks: quiet,
    counts: {
      blocks: input.blocks.length,
      health: input.health.length,
      agri: input.agri.length,
      weather: input.weather.length,
    },
    thresholds: THRESHOLDS,
    elapsed_ms: elapsed,
  });
});
