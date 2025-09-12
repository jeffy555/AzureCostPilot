import type { Express } from "express";
import axios from "axios";
import OpenAI from "openai";
import { storage } from "./storage";
import type { Request, Response } from "express";

type Provider = "azure" | "aws" | "gcp" | "mongodb";

type TopService = { name: string; amount: number };

type AgentSummary = {
  provider: Provider;
  currency: "USD";
  mtdTotal: number;
  topServices: TopService[];
  start: string;
  end: string;
};

type AgentRecommendation = {
  title: string;
  detail: string;
  impact: "low" | "medium" | "high";
  action: string;
};

type AgentResult = {
  summary: AgentSummary;
  recommendations: AgentRecommendation[];
  metadata: { generatedAt: string; cached?: boolean; engine?: "llm" | "rules" };
};

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const agentCache: Record<string, { data: AgentResult; expiry: number }> = {};

function getMonthWindowUtc(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

function sumByService(entries: Array<{ serviceName?: string | null; dailyCost?: string | number | null; monthlyCost?: string | number | null; date?: string }>, start: string, end: string) {
  const byService: Record<string, number> = {};
  for (const e of entries) {
    // date filter when present
    if (e.date && (e.date < start || e.date >= end)) continue;
    const key = (e.serviceName || "Unknown").toString();
    const raw = e.monthlyCost ?? e.dailyCost ?? 0;
    const amount = typeof raw === "string" ? parseFloat(raw) : Number(raw);
    if (!isFinite(amount)) continue;
    byService[key] = (byService[key] || 0) + amount;
  }
  return Object.entries(byService)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7);
}

async function buildSummary(provider: Provider, baseUrl: string): Promise<AgentSummary> {
  const { start, end } = getMonthWindowUtc();
  let mtdTotal = 0;
  let topServices: TopService[] = [];

  if (provider === "azure") {
    const rows = (await storage.getCostData()).filter((r: any) => r.provider === "azure");
    // all USD already
    const filtered = rows.filter((r: any) => !r.date || (r.date >= start && r.date < end));
    mtdTotal = filtered.reduce((s: number, r: any) => {
      const raw = r.monthlyCost ?? r.dailyCost ?? 0;
      const v = typeof raw === "string" ? parseFloat(raw) : Number(raw);
      return s + (isFinite(v) ? v : 0);
    }, 0);
    topServices = sumByService(filtered as any, start, end);
  } else if (provider === "aws") {
    const [sumRes, svcRes] = await Promise.all([
      axios.get(`${baseUrl}/api/aws/mtd-summary`),
      axios.get(`${baseUrl}/api/aws/mtd-services`),
    ]);
    mtdTotal = Number(sumRes.data?.total || 0);
    topServices = (svcRes.data?.services || []).map((s: any) => ({ name: s.service, amount: Number(s.amount || 0) })).slice(0, 7);
  } else if (provider === "gcp") {
    const [sumRes, svcRes] = await Promise.all([
      axios.get(`${baseUrl}/api/gcp/mtd-summary`),
      axios.get(`${baseUrl}/api/gcp/mtd-services`),
    ]);
    mtdTotal = Number(sumRes.data?.total || 0);
    topServices = (svcRes.data?.services || []).map((s: any) => ({ name: s.service, amount: Number(s.amount || 0) })).slice(0, 7);
  } else if (provider === "mongodb") {
    // Prefer Cost Explorer two-step for MTD
    try {
      const initRes = await axios.post(`${baseUrl}/api/mongodb/ce-init`);
      const token = initRes.data?.token;
      if (token) {
        let usageAmount: number | null = null;
        for (let i = 0; i < 6; i++) {
          const u = await axios.get(`${baseUrl}/api/mongodb/ce-usage/${token}`);
          const data = u.data;
          if (data?.status === "COMPLETED" || data?.usageAmount !== undefined) {
            usageAmount = Number(data?.usageAmount || 0);
            break;
          }
          await new Promise(r => setTimeout(r, 600));
        }
        if (usageAmount !== null) mtdTotal = usageAmount;
      }
    } catch (_e) {
      // fallback to stored data
      const rows = (await storage.getCostData()).filter((r: any) => r.provider === "mongodb");
      const filtered = rows.filter((r: any) => !r.date || (r.date >= start && r.date < end));
      mtdTotal = filtered.reduce((s: number, r: any) => {
        const raw = r.monthlyCost ?? r.dailyCost ?? 0;
        const v = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        return s + (isFinite(v) ? v : 0);
      }, 0);
    }
    topServices = [];
  }

  return { provider, currency: "USD", mtdTotal, topServices, start, end };
}

function rulesFallback(summary: AgentSummary): AgentResult {
  const { provider, mtdTotal, topServices, start, end } = summary;
  const topName = topServices[0]?.name || "Top Service";
  const recs: AgentRecommendation[] = [];

  if (provider === "aws" || provider === "azure" || provider === "gcp") {
    recs.push({
      title: provider === "aws" ? "Buy Savings Plans/RI for steady compute" : "Commitment discounts for steady compute",
      detail: `Compute dominates spend (e.g., ${topName}). Leverage 1-year commitments to reduce on-demand rates by 25–60%.`,
      impact: "high",
      action: "Analyze last 30–60 days usage; purchase conservative 1‑year no‑upfront commitments."
    });
    recs.push({
      title: "Rightsize underutilized instances/services",
      detail: "Identify low CPU/memory utilization and scale down or switch to cheaper families/classes.",
      impact: "high",
      action: "Enable autoscaling; set budgets+alerts; downsize instances with <30% avg utilization."
    });
    recs.push({
      title: "Optimize storage tiers and lifecycle",
      detail: "Move infrequent data to colder tiers and enforce deletion/archival on stale objects/logs.",
      impact: "medium",
      action: "Configure lifecycle rules to transition after 30/60/90 days; shorten log retention."
    });
    recs.push({
      title: "Reduce egress and inter‑region traffic",
      detail: "Place compute near data, use CDN/caching, and minimize cross‑region chatter.",
      impact: "medium",
      action: "Enable CDN; cache hot content; collocate services with their data stores."
    });
    recs.push({
      title: "Turn off idle non‑prod during off hours",
      detail: "Schedule dev/test to stop nights/weekends; often saves 50%+ on those environments.",
      impact: "medium",
      action: "Use instance schedules or serverless for spiky workloads."
    });
  } else if (provider === "mongodb") {
    recs.push({
      title: "Rightsize Atlas cluster tier",
      detail: "Match cluster size to observed CPU/IOPS; avoid overprovisioning.",
      impact: "high",
      action: "Review metrics for last 14 days; step down one tier and monitor latency."
    });
    recs.push({
      title: "Adjust backup frequency and retention",
      detail: "Backups and snapshots can drive storage costs if retained too long.",
      impact: "medium",
      action: "Trim retention for non‑prod; enable PITR only where required."
    });
    recs.push({
      title: "Optimize storage & compression",
      detail: "Use appropriate storage class and schema compression to lower IO and size.",
      impact: "medium",
      action: "Enable WiredTiger compression; archive cold collections; review index bloat."
    });
    recs.push({
      title: "Control egress and inter‑VPC traffic",
      detail: "Reduce data transfer via caching and peering; place apps close to clusters.",
      impact: "low",
      action: "Peer VPCs; cache hot queries; avoid cross‑region reads."
    });
  }

  return {
    summary,
    recommendations: recs,
    metadata: { generatedAt: new Date().toISOString(), engine: "rules" },
  };
}

async function callOpenAI(summary: AgentSummary): Promise<AgentResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
  if (!apiKey) return rulesFallback(summary);

  const model = process.env.AGENT_MODEL || process.env.agent_model || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const schemaHint = {
    type: "object",
    properties: {
      summary: {
        type: "object",
        properties: {
          provider: { type: "string" },
          currency: { type: "string" },
          mtdTotal: { type: "number" },
          topServices: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" } }, required: ["name", "amount"] }
          },
          start: { type: "string" },
          end: { type: "string" }
        },
        required: ["provider", "currency", "mtdTotal", "topServices", "start", "end"]
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            impact: { type: "string", enum: ["low", "medium", "high"] },
            action: { type: "string" }
          },
          required: ["title", "detail", "impact", "action"]
        }
      },
      metadata: { type: "object" }
    },
    required: ["summary", "recommendations"]
  } as const;

  const sys = `You are a cloud cost optimization assistant. Return JSON only matching the provided schema. Do not include secrets. Keep each recommendation ≤ 3 sentences. Tailor items to the provider: ${summary.provider}. Currency is USD.`;
  const user = {
    provider: summary.provider,
    currency: summary.currency,
    mtdTotal: summary.mtdTotal,
    topServices: summary.topServices,
    window: { start: summary.start, end: summary.end }
  };

  try {
    const resp = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify({ schema: schemaHint, facts: user }) },
      ],
    });

    const content = resp.choices?.[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(content);
      const result: AgentResult = {
        summary,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        metadata: { generatedAt: new Date().toISOString(), engine: "llm" },
      };
      return result;
    } catch (_err) {
      return rulesFallback(summary);
    }
  } catch (_errOuter) {
    // Network/quota/model errors → fallback to rules
    return rulesFallback(summary);
  }
}

export async function registerAgentRoutes(app: Express) {
  app.post("/api/agent/suggest", async (req, res) => {
    try {
      const provider = (req.body?.provider || "").toString().toLowerCase() as Provider;
      if (!provider || !["azure", "aws", "gcp", "mongodb"].includes(provider)) {
        return res.status(400).json({ message: "Invalid provider. Use one of: azure, aws, gcp, mongodb" });
      }

      const { start } = getMonthWindowUtc();
      const cacheKey = `${provider}:${start}`;
      const now = Date.now();
      const cached = agentCache[cacheKey];
      if (cached && now - cached.expiry < CACHE_TTL_MS) {
        return res.json({ ...cached.data, metadata: { ...cached.data.metadata, cached: true } });
      }

      const baseUrl = process.env.AGENT_INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 9003}`;
      const summary = await buildSummary(provider, baseUrl);
      // Optional hard switch to rules-only (for testing or to avoid spend)
      const forceRules = (process.env.AGENT_FORCE_RULES === "1") || (req.query?.force === "rules");
      const result = forceRules ? rulesFallback(summary) : await callOpenAI(summary);
      agentCache[cacheKey] = { data: result, expiry: now };
      return res.json(result);
    } catch (err: any) {
      const message = err?.message || "Failed to generate suggestions";
      return res.status(500).json({ message });
    }
  });

  // (moved) OpenAI usage route lives in server/openai.ts
}


