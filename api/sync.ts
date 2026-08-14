/**
 * Drain target for the client op log.
 *
 * Accepts a batch of ops and answers per op, not per batch. A retried op comes
 * back as a duplicate rather than an error, because from the device's point of
 * view "you already have it" and "I just gave it to you" are the same success:
 * in both cases the op can be dropped from the outbox.
 *
 * Conflict policy is last-write-wins on the device-issued op_id, and that is
 * correct rather than merely convenient here. Each observation is written once
 * by one worker and is never edited, so there is no concurrent mutation for a
 * CRDT to reconcile.
 */

import { getDb } from "../shared/db.js";
import { applyOps, ensureSchema } from "../shared/repo.js";
import type { SyncOp } from "../shared/types.js";
import { handle, methodNotAllowed, readJson, type Req, type Res } from "./_lib.js";

const MAX_BATCH = 200;

export default handle(async (req: Req, res: Res) => {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  const body = readJson<{ ops?: SyncOp[] }>(req);
  const ops = Array.isArray(body.ops) ? body.ops : [];

  if (ops.length === 0) {
    res.status(400).json({ error: "Send at least one op in { ops: [...] }." });
    return;
  }
  if (ops.length > MAX_BATCH) {
    res.status(413).json({
      error: `Batch too large. Send at most ${MAX_BATCH} ops per request.`,
    });
    return;
  }

  const invalid = ops.filter(
    (o) => !o?.op_id || !o?.block_id || (o.kind !== "health" && o.kind !== "agri"),
  );
  if (invalid.length > 0) {
    res.status(400).json({
      error: "Every op needs op_id, block_id and kind of health or agri.",
      invalid: invalid.map((o) => o?.op_id ?? null),
    });
    return;
  }

  const db = await getDb();
  await ensureSchema(db);

  const started = Date.now();
  const result = await applyOps(db, ops);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ...result,
    received: ops.length,
    elapsed_ms: Date.now() - started,
  });
});
