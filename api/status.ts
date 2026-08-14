/**
 * Deployment smoke test. Hit this first, before writing any feature code, so
 * a missing environment variable is discovered at hour zero rather than at
 * 22:30 the night of the deadline.
 *
 * Reports whether each variable is present without ever echoing its value.
 */

import { getDb } from "../shared/db.js";
import { countRows } from "../shared/repo.js";
import { handle, today, type Req, type Res } from "./_lib.js";

export default handle(async (_req: Req, res: Res) => {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    OPENWEATHER_KEY: Boolean(process.env.OPENWEATHER_KEY),
    SEED_TOKEN: Boolean(process.env.SEED_TOKEN),
  };

  let db: { driver: string; reachable: boolean; rows?: Record<string, number>; error?: string } = {
    driver: "unknown",
    reachable: false,
  };

  try {
    const handle_ = await getDb();
    const rows = await countRows(handle_);
    db = { driver: handle_.driver, reachable: true, rows };
  } catch (err) {
    db = {
      driver: process.env.DATABASE_URL ? "neon" : "pglite",
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  res.status(200).json({
    ok: env.DATABASE_URL && db.reachable,
    as_of: today(),
    env,
    db,
    note: db.reachable
      ? undefined
      : "Set DATABASE_URL in the Vercel project settings, then redeploy and seed.",
  });
});
