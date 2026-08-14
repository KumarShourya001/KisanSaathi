/**
 * Local stand-in for Vercel Functions.
 *
 * Mounts the exact same handler modules on a plain Node server so the API can
 * be exercised end to end before anything is deployed. Vite proxies /api to
 * this port in development.
 *
 *   npm run api:dev
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Handler, Req, Res } from "../api/_lib.js";

const PORT = Number(process.env.API_PORT ?? 5174);

const ROUTES: Record<string, () => Promise<{ default: Handler }>> = {
  "/api/status": () => import("../api/status.js"),
  "/api/blocks": () => import("../api/blocks.js"),
  "/api/correlations": () => import("../api/correlations.js"),
  "/api/sync": () => import("../api/sync.js"),
  "/api/seed": () => import("../api/seed.js"),
  "/api/weather": () => import("../api/weather.js"),
  "/api/transcribe": () => import("../api/transcribe.js"),
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function adapt(res: ServerResponse): Res {
  let code = 200;
  return {
    status(c) {
      code = c;
      return this;
    },
    setHeader(k, v) {
      res.setHeader(k, v);
    },
    json(payload) {
      res.statusCode = code;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload, null, 2));
    },
    end(body) {
      res.statusCode = code;
      res.end(body);
    },
  };
}

const server = createServer(async (nodeReq, nodeRes) => {
  const url = new URL(nodeReq.url ?? "/", `http://localhost:${PORT}`);
  const route = ROUTES[url.pathname];
  const res = adapt(nodeRes);

  if (!route) {
    res.status(404).json({ error: `No route ${url.pathname}`, routes: Object.keys(ROUTES) });
    return;
  }

  const raw = await readBody(nodeReq);
  const req: Req = {
    method: nodeReq.method,
    url: nodeReq.url,
    headers: nodeReq.headers as Record<string, string | undefined>,
    body: raw ? JSON.parse(raw) : undefined,
    query: Object.fromEntries(url.searchParams),
  };

  const started = Date.now();
  const mod = await route();
  await mod.default(req, res);
  console.log(`${nodeReq.method} ${url.pathname} ${Date.now() - started}ms`);
});

server.listen(PORT, () => {
  console.log(`dev api on http://127.0.0.1:${PORT}`);
  console.log(`routes: ${Object.keys(ROUTES).join(", ")}`);
});
