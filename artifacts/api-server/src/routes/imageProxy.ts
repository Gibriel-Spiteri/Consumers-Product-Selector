import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/api/image-proxy", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : null;
  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      res.status(400).json({ error: "Invalid protocol" });
      return;
    }

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 502).end();
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch {
    res.status(500).json({ error: "Failed to proxy image" });
  }
});

export default router;
