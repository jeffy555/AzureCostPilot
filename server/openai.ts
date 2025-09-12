import type { Express, Request, Response } from "express";

// Simple in-memory cache to reduce calls to OpenAI usage API
const usageCache: { key: string; data: any; expiry: number } = { key: "", data: null, expiry: 0 };
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function buildCacheKey(qs: URLSearchParams): string {
  return `usage:${qs.get("date") || ""}:${qs.get("start_date") || ""}:${qs.get("end_date") || ""}:${qs.get("limit") || ""}`;
}

export async function registerOpenAiRoutes(app: Express) {
  app.get("/api/openai/usage", async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
      if (!apiKey) return res.status(400).json({ message: "OPENAI_API_KEY not configured" });

      const qs = new URLSearchParams();
      if (typeof req.query.date === "string") qs.set("date", req.query.date);
      if (typeof req.query.start_date === "string") qs.set("start_date", req.query.start_date);
      if (typeof req.query.end_date === "string") qs.set("end_date", req.query.end_date);
      if (typeof req.query.limit === "string") qs.set("limit", req.query.limit);

      // Default to today's UTC date if no date or range provided
      if (!qs.has("date") && !qs.has("start_date") && !qs.has("end_date")) {
        const todayUtc = new Date();
        const dateStr = todayUtc.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
        qs.set("date", dateStr);
      }

      const now = Date.now();
      const key = buildCacheKey(qs);
      if (usageCache.key === key && usageCache.data && now - usageCache.expiry < CACHE_TTL_MS) {
        return res.json(usageCache.data);
      }

      const url = qs.toString() ? `https://api.openai.com/v1/usage?${qs.toString()}` : "https://api.openai.com/v1/usage";
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const json = await r.json();
      if (!r.ok) return res.status(r.status).json(json);

      usageCache.key = key;
      usageCache.data = json;
      usageCache.expiry = now;
      return res.json(json);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch OpenAI usage" });
    }
  });
}


