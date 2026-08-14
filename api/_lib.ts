/**
 * Minimal request and response shapes for Vercel Node functions.
 *
 * Deliberately not depending on @vercel/node: these five members are all the
 * handlers use, and the same shape is trivially satisfied by a plain Node
 * server, which is what lets the local dev API mount the identical handlers.
 *
 * Files prefixed with an underscore are not routed by Vercel.
 */

export interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface Res {
  status(code: number): Res;
  setHeader(key: string, value: string): void;
  json(payload: unknown): void;
  end(body?: string): void;
}

export type Handler = (req: Req, res: Res) => Promise<void> | void;

export function param(req: Req, name: string): string | undefined {
  const fromQuery = req.query?.[name];
  if (typeof fromQuery === "string") return fromQuery;
  if (Array.isArray(fromQuery)) return fromQuery[0];
  if (!req.url) return undefined;
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get(name) ?? undefined;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Wraps a handler so a thrown error becomes a JSON 500 with a readable message
 * rather than an opaque platform error page. On a deadline, the difference
 * between "500" and "relation blocks does not exist" is twenty minutes.
 */
export function handle(fn: Handler): Handler {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[api]", message);
      res.status(500).json({ error: message });
    }
  };
}

/** Body may arrive parsed (Vercel) or as a raw string (some runtimes). */
export function readJson<T>(req: Req): T {
  if (req.body && typeof req.body === "object") return req.body as T;
  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body) as T;
  }
  return {} as T;
}

export function methodNotAllowed(res: Res, allowed: string): void {
  res.setHeader("Allow", allowed);
  res.status(405).json({ error: `Method not allowed. Use ${allowed}.` });
}
