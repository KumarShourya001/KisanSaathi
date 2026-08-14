/**
 * Sarvam AI speech-to-text, proxied so the API key stays server-side.
 *
 *   GET  -> { configured: boolean }   capability probe, used by the client to
 *                                     decide whether to use Sarvam or fall
 *                                     back to the browser's Web Speech API
 *   POST -> { transcript: string }    multipart form with an `audio` file and
 *                                     an optional `language` BCP 47 tag
 *
 * Without SARVAM_API_KEY set, GET reports `configured: false` and the client
 * silently keeps using Web Speech. That is the honest default: the fallback is
 * the path that has been verified end to end, and Sarvam here is implemented
 * but unproven until a real key exists to test against.
 */

import { handle, methodNotAllowed, type Req, type Res } from "./_lib.js";

const SARVAM_ENDPOINT = "https://api.sarvam.ai/speech-to-text";

/** Sarvam expects its own language codes rather than plain BCP 47. */
const LANGUAGE_MAP: Record<string, string> = {
  "en-IN": "en-IN",
  "hi-IN": "hi-IN",
  "mr-IN": "mr-IN",
};

export default handle(async (req: Req, res: Res) => {
  const key = process.env.SARVAM_API_KEY;

  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      configured: Boolean(key),
      provider: "sarvam",
      note: key
        ? "Sarvam key present. The client will use it for speech to text."
        : "No SARVAM_API_KEY set. The client falls back to the browser Web Speech API.",
    });
    return;
  }

  if (req.method !== "POST") return methodNotAllowed(res, "GET, POST");

  if (!key) {
    res.status(503).json({
      error: "SARVAM_API_KEY is not configured on this deployment.",
      fallback: "web-speech",
    });
    return;
  }

  // Vercel gives the raw request; re-post the multipart body straight through
  // rather than parsing and rebuilding it.
  const contentType =
    (req.headers["content-type"] as string | undefined) ?? "application/octet-stream";

  const incoming = (req as unknown as { body?: unknown }).body;
  if (!incoming) {
    res.status(400).json({ error: "Send a multipart form with an `audio` file." });
    return;
  }

  const upstream = await fetch(SARVAM_ENDPOINT, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
      "content-type": contentType,
    },
    body: incoming as BodyInit,
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    res.status(502).json({
      error: `Sarvam responded ${upstream.status}`,
      detail: detail.slice(0, 300),
    });
    return;
  }

  const payload = (await upstream.json()) as {
    transcript?: string;
    language_code?: string;
  };

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    transcript: payload.transcript ?? "",
    language: payload.language_code ?? LANGUAGE_MAP["en-IN"],
    provider: "sarvam",
  });
});
