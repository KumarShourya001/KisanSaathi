import { db, queuedOps, type OutboxOp } from "./db";
import { api, OfflineError } from "./api";

/**
 * Drains the op log to the server.
 *
 * Ordering is by sequence number, batches are capped, and every op is marked
 * `sending` before the request so a page reload mid-flight cannot double-send
 * from this device. If the request fails after the server committed, the retry
 * is absorbed by the server's idempotency check, so the worst case is a
 * duplicate attempt in the audit log rather than a duplicate record.
 */

const BATCH = 50;

export interface DrainOutcome {
  attempted: number;
  accepted: number;
  duplicates: number;
  failed: number;
  offline: boolean;
  error?: string;
}

let inFlight: Promise<DrainOutcome> | null = null;

export function drain(): Promise<DrainOutcome> {
  // Two triggers can fire together (the online event and a manual tap), and
  // running two drains at once would send the same ops twice.
  if (inFlight) return inFlight;
  inFlight = runDrain().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runDrain(): Promise<DrainOutcome> {
  const empty: DrainOutcome = {
    attempted: 0,
    accepted: 0,
    duplicates: 0,
    failed: 0,
    offline: false,
  };

  const ops = (await queuedOps(BATCH)).sort((a, b) => a.seq - b.seq);
  if (ops.length === 0) return empty;

  await db.outbox
    .where("op_id")
    .anyOf(ops.map((o) => o.op_id))
    .modify({ state: "sending" });

  try {
    const result = await api.sync(ops);

    const accepted = new Set(result.accepted);
    const duplicates = new Set(result.duplicates);
    const rejected = new Map(result.rejected.map((r) => [r.op_id, r.reason]));

    await db.transaction("rw", db.outbox, async () => {
      for (const op of ops) {
        if (accepted.has(op.op_id)) {
          await db.outbox.update(op.op_id, { state: "sent", last_error: undefined });
        } else if (duplicates.has(op.op_id)) {
          await db.outbox.update(op.op_id, {
            state: "sent",
            deduped: true,
            last_error: undefined,
          });
        } else {
          await db.outbox.update(op.op_id, {
            state: "failed",
            attempts: op.attempts + 1,
            last_error: rejected.get(op.op_id) ?? "Server did not acknowledge",
          });
        }
      }
    });

    return {
      attempted: ops.length,
      accepted: result.accepted.length,
      duplicates: result.duplicates.length,
      failed: result.rejected.length,
      offline: false,
    };
  } catch (err) {
    const offline = err instanceof OfflineError;
    // Back to queued, not failed: an unreachable server is not a bad record.
    await db.transaction("rw", db.outbox, async () => {
      for (const op of ops) {
        await db.outbox.update(op.op_id, {
          state: offline ? "queued" : "failed",
          attempts: op.attempts + (offline ? 0 : 1),
          last_error: offline ? undefined : err instanceof Error ? err.message : String(err),
        });
      }
    });

    return {
      attempted: ops.length,
      accepted: 0,
      duplicates: 0,
      failed: offline ? 0 : ops.length,
      offline,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Wires the automatic triggers. Returns a teardown for React strict mode. */
export function startAutoSync(onDrain?: (o: DrainOutcome) => void): () => void {
  const fire = () => {
    void drain().then((outcome) => {
      if (outcome.attempted > 0) onDrain?.(outcome);
    });
  };

  window.addEventListener("online", fire);
  const interval = window.setInterval(fire, 20000);
  fire();

  return () => {
    window.removeEventListener("online", fire);
    window.clearInterval(interval);
  };
}
