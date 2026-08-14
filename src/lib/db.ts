import Dexie, { type Table } from "dexie";

/**
 * The offline op log.
 *
 * Append-only in the sense that matters: a record's payload is written once
 * and never edited. The `state`, `attempts` and `last_error` fields are
 * delivery metadata about that op, not the observation itself, so updating
 * them does not rewrite history. A half-finished sync can therefore always be
 * resumed by re-reading the log rather than reconciled.
 */

export type OpState = "queued" | "sending" | "sent" | "failed";

export interface OutboxOp {
  op_id: string;
  kind: "health" | "agri";
  block_id: string;
  device_id: string;
  seq: number;
  created_at: string;
  payload: Record<string, unknown>;
  state: OpState;
  attempts: number;
  last_error?: string;
  /** Set when the server reported it already had this op. Kept so the UI can
   *  show that a retry was absorbed rather than silently swallowed. */
  deduped?: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class RuralBridgeDb extends Dexie {
  outbox!: Table<OutboxOp, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("rural-bridge");
    this.version(1).stores({
      outbox: "op_id, state, created_at, kind, block_id",
      meta: "key",
    });
  }
}

export const db = new RuralBridgeDb();

// ------------------------------------------------------------------ meta

async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Stable per-install identifier. Not a user identity: it exists so the server
 *  can tell two devices apart in the sync audit log. */
export async function deviceId(): Promise<string> {
  const existing = await getMeta<string | null>("device_id", null);
  if (existing) return existing;
  const fresh = `dev-${crypto.randomUUID().slice(0, 8)}`;
  await setMeta("device_id", fresh);
  return fresh;
}

async function nextSeq(): Promise<number> {
  const current = await getMeta<number>("seq", 0);
  const next = current + 1;
  await setMeta("seq", next);
  return next;
}

// ----------------------------------------------------------------- writes

/**
 * The only way a record enters the system. Returns as soon as IndexedDB has
 * durably accepted the write, with no network involved at any point.
 */
export async function enqueue(
  kind: "health" | "agri",
  block_id: string,
  payload: Record<string, unknown>,
): Promise<OutboxOp> {
  const op: OutboxOp = {
    op_id: crypto.randomUUID(),
    kind,
    block_id,
    device_id: await deviceId(),
    seq: await nextSeq(),
    created_at: new Date().toISOString(),
    payload,
    state: "queued",
    attempts: 0,
  };
  await db.outbox.add(op);
  return op;
}

export function pendingCount(): Promise<number> {
  return db.outbox.where("state").anyOf("queued", "failed").count();
}

export function recentOps(limit = 40): Promise<OutboxOp[]> {
  return db.outbox.orderBy("created_at").reverse().limit(limit).toArray();
}

export function queuedOps(limit = 50): Promise<OutboxOp[]> {
  return db.outbox
    .where("state")
    .anyOf("queued", "failed")
    .limit(limit)
    .toArray();
}

/** Demo reset. Clears the queue without touching device identity. */
export async function clearOutbox(): Promise<void> {
  await db.outbox.clear();
}
