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
      if (typeof req.query.start_date === "string") qs.set("start_date", req.query.start_date);
      if (typeof req.query.end_date === "string") qs.set("end_date", req.query.end_date);
      if (typeof req.query.limit === "string") qs.set("limit", req.query.limit);

      // Default to current month window [first_of_month, first_of_next_month)
      if (!qs.has("start_date") || !qs.has("end_date")) {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10);
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0,10);
        if (!qs.has("start_date")) qs.set("start_date", start);
        if (!qs.has("end_date")) qs.set("end_date", end);
      }

      const now = Date.now();
      const key = buildCacheKey(qs);
      if (usageCache.key === key && usageCache.data && now - usageCache.expiry < CACHE_TTL_MS) {
        return res.json(usageCache.data);
      }

      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      const org = process.env.OPENAI_ORG_ID || process.env.openai_org_id || process.env.OPENAI_ORGANIZATION;
      if (org) headers["OpenAI-Organization"] = org;
      const fetchDay = async (dateStr: string) => {
        const url = `https://api.openai.com/v1/usage?date=${dateStr}`;
        const r = await fetch(url, { headers });
        const j = await r.json();
        if (!r.ok) throw Object.assign(new Error(j?.error?.message || `OpenAI usage error ${r.status}`), { status: r.status, body: j });
        return j;
      };

      // If a single 'date' is provided by client, fetch that day directly
      if (typeof (req.query as any).date === "string") {
        const dateStr = String((req.query as any).date);
        const out = await fetchDay(dateStr);
        usageCache.key = key; usageCache.data = out; usageCache.expiry = now;
        return res.json(out);
      }

      // Otherwise, iterate from start_date to end_date (inclusive of both), aggregating results
      const startStr = qs.get("start_date")!;
      const endStr = qs.get("end_date")!;
      const start = new Date(`${startStr}T00:00:00Z`);
      const end = new Date(`${endStr}T00:00:00Z`);
      const dates: string[] = [];
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0,10));
      }

      let totalUsageCents = 0;
      let usageUsd = 0;
      const dailyCosts: any[] = [];
      for (const ds of dates) {
        try {
          const day = await fetchDay(ds);
          if (typeof day.total_usage === "number") totalUsageCents += day.total_usage;
          if (typeof day.usage_in_usd === "number") usageUsd += day.usage_in_usd;
          if (Array.isArray(day.daily_costs)) {
            for (const item of day.daily_costs) {
              // some day payloads return a single day; keep structure consistent
              dailyCosts.push(item);
            }
          } else {
            // fabricate a daily_costs item if not present
            const usd = typeof day.usage_in_usd === "number" ? day.usage_in_usd : (typeof day.total_usage === "number" ? day.total_usage/100 : 0);
            dailyCosts.push({ timestamp: Math.floor(new Date(ds+"T00:00:00Z").getTime()/1000), line_items: [], usd_cost: usd });
          }
        } catch (err: any) {
          // skip failing days, continue aggregation
        }
      }

      const aggregated = {
        object: "list",
        start_date: startStr,
        end_date: endStr,
        total_usage: totalUsageCents,
        usage_in_usd: usageUsd > 0 ? usageUsd : undefined,
        daily_costs: dailyCosts,
      };

      usageCache.key = key; usageCache.data = aggregated; usageCache.expiry = now;
      return res.json(aggregated);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch OpenAI usage" });
    }
  });
}


