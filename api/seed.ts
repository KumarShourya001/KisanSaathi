/**
 * One-shot seeding for a fresh database. Run once after the first deploy.
 *
 *   curl -X POST "https://YOUR-APP.vercel.app/api/seed" \
 *        -H "x-seed-token: THE_TOKEN_YOU_SET"
 *
 * Guarded because it deletes everything first. With a live DATABASE_URL the
 * token is mandatory; without one you are on local PGlite and it is open.
 */

import { getDb } from "../shared/db.js";
import { ensureSchema, replaceSeed, countRows } from "../shared/repo.js";
import { buildSeed } from "../shared/seed.js";
import { handle, methodNotAllowed, param, today, type Req, type Res } from "./_lib.js";

export default handle(async (req: Req, res: Res) => {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  const isRemote = Boolean(process.env.DATABASE_URL);
  const expected = process.env.SEED_TOKEN;

  if (isRemote) {
    if (!expected) {
      res.status(403).json({
        error:
          "Set a SEED_TOKEN environment variable before seeding a live database.",
      });
      return;
    }
    const supplied = req.headers["x-seed-token"];
    if (supplied !== expected) {
      res.status(401).json({ error: "Bad or missing x-seed-token header." });
      return;
    }
  }

  const asOf = param(req, "as_of") ?? today();
  const db = await getDb();
  await ensureSchema(db);

  const started = Date.now();
  const data = buildSeed(asOf);
  await replaceSeed(db, data);
  const counts = await countRows(db);

  res.status(200).json({
    seeded: true,
    as_of: asOf,
    driver: db.driver,
    counts,
    elapsed_ms: Date.now() - started,
    note: "Synthetic data. Five blocks are rigged: see shared/seed.ts.",
  });
});
