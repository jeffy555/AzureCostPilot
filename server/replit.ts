import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

type ReplitUsage = {
  totalUsage: number; // arbitrary unit from API
  workspaces?: Array<{ id: string; name?: string; usage: number }>;
  period: { start: string; end: string };
};

const GRAPHQL_ENDPOINT = process.env.REPLIT_GRAPHQL_ENDPOINT || "https://replit.com/graphql";
const DATA_DIR = path.resolve(process.cwd(), "data");
const SNAPSHOT_FILE = path.join(DATA_DIR, "replit-usage.json");

// Very small cache to avoid hammering
let cache: { key: string; data: any; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

function buildCacheKey(name: string, vars: Record<string, any>): string {
  return `${name}:${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("&")}`;
}

async function ensureDataDir(): Promise<void> {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

async function fetchGraphQL(operationName: string, query: string, variables: Record<string, any>): Promise<any> {
  const key = buildCacheKey(operationName, variables);
  const now = Date.now();
  if (cache && cache.key === key && (now - cache.ts) < CACHE_TTL_MS) {
    return cache.data;
  }
  const cookie = process.env.REPLIT_GRAPHQL_COOKIE || process.env.REPLIT_COOKIE || "";
  const ua = process.env.REPLIT_GRAPHQL_UA || "Mozilla/5.0";
  const clientVersion = process.env.REPLIT_GRAPHQL_CLIENT_VERSION || "";
  const r = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { "cookie": cookie } : {}),
      "origin": "https://replit.com",
      "referer": "https://replit.com/usage",
      "user-agent": ua,
      "x-requested-with": "XMLHttpRequest",
      ...(clientVersion ? { "x-client-version": clientVersion } : {}),
    },
    body: JSON.stringify({ operationName, query, variables }),
  });
  const json = await r.json().catch(() => ({}));
  cache = { key, data: json, ts: now };
  return json;
}

async function fetchGraphQLWithMeta(operationName: string, query: string, variables: Record<string, any>): Promise<{ status: number; json: any }> {
  const cookie = process.env.REPLIT_GRAPHQL_COOKIE || process.env.REPLIT_COOKIE || "";
  const ua = process.env.REPLIT_GRAPHQL_UA || "Mozilla/5.0";
  const clientVersion = process.env.REPLIT_GRAPHQL_CLIENT_VERSION || "";
  const r = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(cookie ? { "cookie": cookie } : {}),
      "origin": "https://replit.com",
      "referer": "https://replit.com/usage",
      "user-agent": ua,
      "x-requested-with": "XMLHttpRequest",
      ...(clientVersion ? { "x-client-version": clientVersion } : {}),
    },
    body: JSON.stringify({ operationName, query, variables }),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

async function fetchGraphQLPersisted(operationName: string, sha256Hash: string, variables: Record<string, any>): Promise<{ status: number; json: any }> {
  const cookie = process.env.REPLIT_GRAPHQL_COOKIE || process.env.REPLIT_COOKIE || "";
  const ua = process.env.REPLIT_GRAPHQL_UA || "Mozilla/5.0";
  const clientVersion = process.env.REPLIT_GRAPHQL_CLIENT_VERSION || "";
  const r = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(cookie ? { "cookie": cookie } : {}),
      "origin": "https://replit.com",
      "referer": "https://replit.com/usage",
      "user-agent": ua,
      "x-requested-with": "XMLHttpRequest",
      ...(clientVersion ? { "x-client-version": clientVersion } : {}),
    },
    body: JSON.stringify({
      operationName,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    }),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

function findUsageInterval(obj: any): any | null {
  if (!obj || typeof obj !== "object") return null;
  if (obj.usageInterval && typeof obj.usageInterval === "object") return obj.usageInterval;
  if (obj.billing && obj.billing.usageInterval) return obj.billing.usageInterval;
  if (obj.viewer && obj.viewer.billing && obj.viewer.billing.usageInterval) return obj.viewer.billing.usageInterval;
  if (obj.me && obj.me.billing && obj.me.billing.usageInterval) return obj.me.billing.usageInterval;
  for (const v of Object.values(obj)) {
    const found = findUsageInterval(v);
    if (found) return found;
  }
  return null;
}

// Example query names and shapes – these may need adjustment based on real network traces
const QUERY_USAGE_SUMMARY = `query usageSummary($start: String!, $end: String!) {
  usageSummary(startDate: $start, endDate: $end) { total }
}`;

const QUERY_USAGE_BY_WORKSPACE = `query workspaceUsage($start: String!, $end: String!) {
  workspaceUsage(startDate: $start, endDate: $end) {
    id
    name
    usage
  }
}`;

// Try multiple shapes for usageInterval based on observed network traces
const QUERY_USAGE_INTERVAL_ROOT = `query GetUsageIntervalRoot($start: String!, $end: String!) {
  usageInterval(startDate: $start, endDate: $end) {
    startDate
    endDate
    totalAmountUsd
    subtotalAmountUsd
    planDiscountUsd
    credits {
      availableAdditionalCredits
      availableSubscriptionCredits
      totalGrantedAdditionalCredits
      totalGrantedSubscriptionCredits
      __typename
    }
    __typename
  }
}`;

const QUERY_USAGE_INTERVAL_BILLING = `query GetUsageIntervalBilling($start: String!, $end: String!) {
  billing {
    usageInterval(startDate: $start, endDate: $end) {
      startDate
      endDate
      totalAmountUsd
      subtotalAmountUsd
      planDiscountUsd
      credits {
        availableAdditionalCredits
        availableSubscriptionCredits
        totalGrantedAdditionalCredits
        totalGrantedSubscriptionCredits
        __typename
      }
      __typename
    }
  }
}`;

const QUERY_USAGE_INTERVAL_VIEWER = `query GetUsageIntervalViewer($start: String!, $end: String!) {
  viewer {
    billing {
      usageInterval(startDate: $start, endDate: $end) {
        startDate
        endDate
        totalAmountUsd
        subtotalAmountUsd
        planDiscountUsd
        credits {
          availableAdditionalCredits
          availableSubscriptionCredits
          totalGrantedAdditionalCredits
          totalGrantedSubscriptionCredits
          __typename
        }
        __typename
      }
    }
  }
}`;

const QUERY_USAGE_INTERVAL_ME = `query GetUsageIntervalMe($start: String!, $end: String!) {
  me {
    billing {
      usageInterval(startDate: $start, endDate: $end) {
        startDate
        endDate
        totalAmountUsd
        subtotalAmountUsd
        planDiscountUsd
        credits {
          availableAdditionalCredits
          availableSubscriptionCredits
          totalGrantedAdditionalCredits
          totalGrantedSubscriptionCredits
          __typename
        }
        __typename
      }
    }
  }
}`;

function toUtcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthWindowUtc(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: toUtcDateString(start), end: toUtcDateString(end) };
}

// Replit billing overview observed window (from network payload):
// startDate = last day of previous month T00:00:00Z
// endDate   = last day of current month  T00:00:00Z
function replitBillingWindowIso(): { startIso: string; endIso: string } {
  const now = new Date();
  // Last day of previous month
  const prevLast = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  prevLast.setUTCHours(0, 0, 0, 0);
  // Last day of current month
  const currLast = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  currLast.setUTCHours(0, 0, 0, 0);
  return { startIso: prevLast.toISOString(), endIso: currLast.toISOString() };
}

function estimateSpend(totalUsage: number): number {
  const rate = Number(process.env.REPLIT_USAGE_RATE_USD || "0");
  return Number((totalUsage * rate).toFixed(2));
}

async function snapshotToFile(payload: any): Promise<void> {
  await ensureDataDir();
  try { fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({ ts: new Date().toISOString(), payload }, null, 2)); } catch {}
}

export async function registerReplitRoutes(app: Express) {
  // GET /api/replit/usage/today
  app.get("/api/replit/usage/today", async (_req: Request, res: Response) => {
    try {
      const today = toUtcDateString(new Date());
      const g = await fetchGraphQL("usageSummary", QUERY_USAGE_SUMMARY, { start: today, end: today });
      const totalUsage = Number(g?.data?.usageSummary?.total || 0);
      const spend = estimateSpend(totalUsage);
      const out: ReplitUsage = { totalUsage, period: { start: today, end: today } };
      await snapshotToFile(out);
      return res.json({ totalUsage, estimatedSpendUsd: spend, start: today, end: today });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch Replit usage (today)" });
    }
  });

  // GET /api/replit/usage/month
  app.get("/api/replit/usage/month", async (req: Request, res: Response) => {
    try {
      const { start, end } = monthWindowUtc();
      const { startIso, endIso } = replitBillingWindowIso();
      // Try several shapes in order
      const boRoot = await fetchGraphQLWithMeta("GetUsageIntervalRoot", QUERY_USAGE_INTERVAL_ROOT, { start: startIso, end: endIso });
      let interval = boRoot?.json?.data?.usageInterval || null;
      const boBilling = !interval ? await fetchGraphQLWithMeta("GetUsageIntervalBilling", QUERY_USAGE_INTERVAL_BILLING, { start: startIso, end: endIso }) : undefined;
      interval = interval || boBilling?.json?.data?.billing?.usageInterval || null;
      const boViewer = !interval ? await fetchGraphQLWithMeta("GetUsageIntervalViewer", QUERY_USAGE_INTERVAL_VIEWER, { start: startIso, end: endIso }) : undefined;
      interval = interval || boViewer?.json?.data?.viewer?.billing?.usageInterval || null;
      const boMe = !interval ? await fetchGraphQLWithMeta("GetUsageIntervalMe", QUERY_USAGE_INTERVAL_ME, { start: startIso, end: endIso }) : undefined;
      interval = interval || boMe?.json?.data?.me?.billing?.usageInterval || null;

      // Persisted query fallback if provided via env
      let boPersisted: { status: number; json: any } | undefined;
      if (!interval) {
        const hash = process.env.REPLIT_GRAPHQL_PERSISTED_HASH || process.env.REPLIT_HASH_USAGE_INTERVAL || process.env.REPLIT_GRAPHQL_HASH_USAGE_INTERVAL || "";
        const op = process.env.REPLIT_GRAPHQL_OPERATION || process.env.REPLIT_OP_USAGE_INTERVAL || "UsageInterval";
        if (hash) {
          boPersisted = await fetchGraphQLPersisted(op, hash, { start: startIso, end: endIso });
          interval = findUsageInterval(boPersisted?.json?.data) || null;
        }
      }

      if (interval) {
          await snapshotToFile({ interval });
          if (String(req.query.debug || "").toLowerCase() === "1" || String(req.query.debug || "").toLowerCase() === "true") {
            const totalAmountUsd = Number(interval.totalAmountUsd || 0);
            const subtotalAmountUsd = Number(interval.subtotalAmountUsd || 0);
            const credits = interval.credits || null;
            return res.json({
              start,
              end,
              totalAmountUsd,
              subtotalAmountUsd,
              credits,
              debug: {
                endpoint: GRAPHQL_ENDPOINT,
                variables: { startIso, endIso },
                ua: process.env.REPLIT_GRAPHQL_UA || "",
                clientVersion: process.env.REPLIT_GRAPHQL_CLIENT_VERSION || "",
                cookiePresent: Boolean(process.env.REPLIT_GRAPHQL_COOKIE || process.env.REPLIT_COOKIE || ""),
                raw: { boRoot, boBilling, boViewer, boMe, boPersisted },
              }
            });
          }
          const totalAmountUsd = Number(interval.totalAmountUsd || 0);
          const subtotalAmountUsd = Number(interval.subtotalAmountUsd || 0);
          const credits = interval.credits || null;
          return res.json({ start, end, totalAmountUsd, subtotalAmountUsd, credits });
      }

      // Fallback to usage summary if billing overview is not accessible
      const g = await fetchGraphQLWithMeta("usageSummary", QUERY_USAGE_SUMMARY, { start, end });
      const totalUsage = Number(g?.json?.data?.usageSummary?.total || 0);
      const spend = estimateSpend(totalUsage);
      const out: ReplitUsage = { totalUsage, period: { start, end } };
      await snapshotToFile(out);
      if (String(req.query.debug || "").toLowerCase() === "1" || String(req.query.debug || "").toLowerCase() === "true") {
        return res.json({
          totalUsage,
          estimatedSpendUsd: spend,
          start,
          end,
          debug: {
            endpoint: GRAPHQL_ENDPOINT,
            variables: { start, end },
            ua: process.env.REPLIT_GRAPHQL_UA || "",
            clientVersion: process.env.REPLIT_GRAPHQL_CLIENT_VERSION || "",
            cookiePresent: Boolean(process.env.REPLIT_GRAPHQL_COOKIE || process.env.REPLIT_COOKIE || ""),
            cookieSnippet: (process.env.REPLIT_GRAPHQL_COOKIE || process.env.REPLIT_COOKIE || "").slice(0, 64) + "…",
            raw: { boRoot, boBilling, boViewer, boMe, g },
          }
        });
      }
      return res.json({ totalUsage, estimatedSpendUsd: spend, start, end });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch Replit usage (month)" });
    }
  });

  // GET /api/replit/usage/by-workspace?start=YYYY-MM-DD&end=YYYY-MM-DD
  app.get("/api/replit/usage/by-workspace", async (req: Request, res: Response) => {
    try {
      const start = typeof req.query.start === "string" ? req.query.start : monthWindowUtc().start;
      const end = typeof req.query.end === "string" ? req.query.end : monthWindowUtc().end;
      const g = await fetchGraphQL("workspaceUsage", QUERY_USAGE_BY_WORKSPACE, { start, end });
      const rows: Array<{ id: string; name?: string; usage: number }> = Array.isArray(g?.data?.workspaceUsage)
        ? g.data.workspaceUsage.map((w: any) => ({ id: String(w.id), name: w.name, usage: Number(w.usage || 0) }))
        : [];
      const totalUsage = rows.reduce((s, r) => s + (Number.isFinite(r.usage) ? r.usage : 0), 0);
      const spend = estimateSpend(totalUsage);
      const out: ReplitUsage = { totalUsage, workspaces: rows, period: { start, end } };
      await snapshotToFile(out);
      return res.json({ totalUsage, estimatedSpendUsd: spend, start, end, workspaces: rows });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Failed to fetch Replit usage by workspace" });
    }
  });
}


