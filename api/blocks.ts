import { getDb } from "../shared/db.js";
import { listBlocks } from "../shared/repo.js";
import { handle, methodNotAllowed, type Req, type Res } from "./_lib.js";

export default handle(async (req: Req, res: Res) => {
  if (req.method && req.method !== "GET") return methodNotAllowed(res, "GET");

  const db = await getDb();
  const blocks = await listBlocks(db);

  // Blocks are reference data and change roughly never, so let the browser and
  // the service worker keep them.
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  res.status(200).json({ blocks });
});
