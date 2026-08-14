import type { Block, CorrelationFlag, SyncResult } from "../../shared/types";
import type { OutboxOp } from "./db";

/**
 * Every network call goes through here so timeouts and offline detection are
 * handled in exactly one place. A field device on a weak edge connection will
 * hang for 30 seconds on a default fetch, which reads to the user as a frozen
 * app, so requests are given a short leash and allowed to fail fast into the
 * offline path.
 */

const TIMEOUT_MS = 8000;

export class OfflineError extends Error {
  constructor(message = "No connection") {
    super(message);
    this.name = "OfflineError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new OfflineError();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(path, { ...init, signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OfflineError("Request timed out");
    }
    if (err instanceof TypeError) throw new OfflineError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface CorrelationResponse {
  as_of: string;
  flags: CorrelationFlag[];
  quiet_blocks: { block_id: string; name: string }[];
  counts: { blocks: number; health: number; agri: number; weather: number };
  elapsed_ms: number;
}

export const api = {
  blocks: () => request<{ blocks: Block[] }>("/api/blocks"),

  correlations: (asOf?: string) =>
    request<CorrelationResponse>(
      `/api/correlations${asOf ? `?as_of=${asOf}` : ""}`,
    ),

  sync: (ops: OutboxOp[]) =>
    request<SyncResult & { received: number; elapsed_ms: number }>("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ops: ops.map((o) => ({
          op_id: o.op_id,
          kind: o.kind,
          block_id: o.block_id,
          device_id: o.device_id,
          seq: o.seq,
          created_at: o.created_at,
          payload: o.payload,
        })),
      }),
    }),

  status: () => request<Record<string, unknown>>("/api/status"),
};
