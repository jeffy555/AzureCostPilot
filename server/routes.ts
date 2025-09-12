import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as dotenv from "dotenv";
dotenv.config();
import { insertServicePrincipalSchema, insertCostSummarySchema } from "@shared/schema";
import { ClientSecretCredential } from "@azure/identity";
import { CostManagementClient } from "@azure/arm-costmanagement";
import { ConsumptionManagementClient } from "@azure/arm-consumption";
import axios from "axios";
import DigestFetch from "digest-fetch";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple in-memory cache for MongoDB Cost Explorer usage to reduce latency and API calls
type CeCacheEntry = {
  token: string | null;
  usageAmount: number | null;
  cachedAtMs: number; // when usageAmount was cached
  tokenAtMs: number; // when token was obtained
  inFlight?: Promise<void>; // de-dup concurrent CE fetches
};
const CE_USAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CE_TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes (tokens are short lived for polling)
const ceCacheByOrg: Record<string, CeCacheEntry> = {};


// Real trend calculation from historical data
async function calculateRealTrendData(costData: any[]): Promise<any> {
  if (costData.length === 0) {
    return {
      labels: [],
      values: []
    };
  }

  // Group cost data by date and calculate daily totals
  const dailyCosts: Record<string, number> = {};
  
  costData.forEach(entry => {
    const dateKey = new Date(entry.date).toISOString().split('T')[0];
    const dailyCost = parseFloat(entry.dailyCost || "0");
    dailyCosts[dateKey] = (dailyCosts[dateKey] || 0) + dailyCost;
  });

  // Sort dates and get last 7 days of data
  const sortedDates = Object.keys(dailyCosts).sort();
  const last7Days = sortedDates.slice(-7);
  
  const labels = last7Days.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const values = last7Days.map(date => dailyCosts[date] || 0);

  return {
    labels: labels.length > 0 ? labels : ['No Data'],
    values: values.length > 0 ? values : [0]
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Service Principal routes
  app.get("/api/service-principals", async (req, res) => {
    try {
      const spns = await storage.getServicePrincipals();
      // Mask sensitive data in response
      const maskedSpns = spns.map(spn => ({
        ...spn,
        clientSecret: "****",
        clientId: spn.clientId ? spn.clientId.replace(/(.{8})(.*)(.{4})/, "$1-****-****-$3") : null,
        tenantId: spn.tenantId ? spn.tenantId.replace(/(.{8})(.*)(.{4})/, "$1-****-****-$3") : null,
      }));
      res.json(maskedSpns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch service principals" });
    }
  });

  app.post("/api/service-principals", async (req, res) => {
    try {
      const validatedData = insertServicePrincipalSchema.parse(req.body);
      const spn = await storage.createServicePrincipal(validatedData);
      
      // Test connection after creation based on provider
      try {
        if (spn.provider === 'azure') {
          await testAzureConnection(spn);
        } else if (spn.provider === 'mongodb') {
          await testMongoDBAtlasConnection(spn);
        }
        await storage.updateServicePrincipal(spn.id, { 
          status: "active", 
          lastSync: new Date(),
          errorMessage: null 
        });
      } catch (connectionError) {
        await storage.updateServicePrincipal(spn.id, { 
          status: "error", 
          errorMessage: connectionError instanceof Error ? connectionError.message : "Connection failed" 
        });
      }
      
      const maskedSpn = {
        ...spn,
        clientSecret: "****",
        clientId: spn.clientId ? spn.clientId.replace(/(.{8})(.*)(.{4})/, "$1-****-****-$3") : null,
        tenantId: spn.tenantId ? spn.tenantId.replace(/(.{8})(.*)(.{4})/, "$1-****-****-$3") : null,
      };
      
      res.status(201).json(maskedSpn);
    } catch (error) {
      res.status(400).json({ message: "Invalid service principal data" });
    }
  });

  app.put("/api/service-principals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedSpn = await storage.updateServicePrincipal(id, updates);
      if (!updatedSpn) {
        return res.status(404).json({ message: "Service principal not found" });
      }
      
      const maskedSpn = {
        ...updatedSpn,
        clientSecret: "****",
        clientId: updatedSpn.clientId ? updatedSpn.clientId.replace(/(.{8})(.*)(.{4})/, "$1-****-****-$3") : null,
        tenantId: updatedSpn.tenantId ? updatedSpn.tenantId.replace(/(.{8})(.*)(.{4})/, "$1-****-****-$3") : null,
      };
      
      res.json(maskedSpn);
    } catch (error) {
      res.status(500).json({ message: "Failed to update service principal" });
    }
  });

  app.delete("/api/service-principals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteServicePrincipal(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Service principal not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service principal" });
    }
  });

  app.post("/api/service-principals/:id/test-connection", async (req, res) => {
    try {
      const { id } = req.params;
      const spn = await storage.getServicePrincipal(id);
      
      if (!spn) {
        return res.status(404).json({ message: "Service principal not found" });
      }
      
      await testAzureConnection(spn);
      await storage.updateServicePrincipal(id, { 
        status: "active", 
        lastSync: new Date(),
        errorMessage: null 
      });
      
      res.json({ success: true, message: "Connection successful" });
    } catch (error) {
      await storage.updateServicePrincipal(req.params.id, { 
        status: "error", 
        errorMessage: error instanceof Error ? error.message : "Connection failed" 
      });
      
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Connection failed" 
      });
    }
  });

  // Cost data routes
  app.get("/api/cost-data", async (req, res) => {
    try {
      const { spnId, dateFrom, dateTo } = req.query;
      
      const filters: any = {};
      if (spnId) filters.spnId = spnId as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      const costData = await storage.getCostData(filters);
      res.json(costData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cost data" });
    }
  });

  app.get("/api/cost-summary", async (req, res) => {
    try {
      const summary = await storage.getLatestCostSummary();
      if (!summary) {
        return res.json({
          id: "default",
          date: new Date(),
          totalMonthlyCost: "0.00",
          todaySpend: "0.00",
          activeResources: "0",
          budgetUtilization: null,
          trendData: { labels: [], values: [] },
          serviceBreakdown: {},
          lastUpdated: new Date(),
        });
      }
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cost summary" });
    }
  });

  // Unified total MTD (USD) across providers
  app.get("/api/total/mtd-usd", async (_req, res) => {
    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      // 1) Azure from stored cost_data (already normalized to USD)
      const azureData = await storage.getCostData({ dateFrom: start, dateTo: end });
      const azure = azureData
        .filter(e => (e.provider || '').toLowerCase() === 'azure')
        .reduce((s, e) => s + (e.monthlyCost ? parseFloat(e.monthlyCost as string) : (e.dailyCost ? parseFloat(e.dailyCost as string) : 0)), 0);

      // 2) AWS and GCP via their summary endpoints (authoritative)
      const port = parseInt(process.env.PORT || '9003', 10);
      const base = `http://127.0.0.1:${port}`;
      const [awsResp, gcpResp] = await Promise.all([
        fetch(`${base}/api/aws/mtd-summary`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`${base}/api/gcp/mtd-summary`).then(r => r.json()).catch(() => ({ total: 0 })),
      ]);
      const aws = Number(awsResp?.total || 0);
      const gcp = Number(gcpResp?.total || 0);

      // 3) MongoDB Atlas MTD via CE cache or fallback to stored entries
      let mongodb = 0;
      try {
        // Try CE cache by reading the latest stored MongoDB monthly costs first
        const mongoData = azureData.filter(e => (e.provider || '').toLowerCase() === 'mongodb');
        const mongoStored = mongoData.reduce((s, e) => s + (e.monthlyCost ? parseFloat(e.monthlyCost as string) : (e.dailyCost ? parseFloat(e.dailyCost as string) : 0)), 0);
        if (mongoStored > 0) {
          mongodb = mongoStored;
        } else {
          // Lightweight CE check using existing endpoints with short polling
          const init = await fetch(`${base}/api/mongodb/ce-init`, { method: 'POST' }).then(r => r.json()).catch(() => null as any);
          if (init && init.token) {
            for (let i = 0; i < 3; i++) {
              const u = await fetch(`${base}/api/mongodb/ce-usage/${init.token}`).then(r => r.json()).catch(() => null as any);
              const amt = Number(u?.usageAmount || 0);
              if (amt > 0) { mongodb = amt; break; }
              await new Promise(r => setTimeout(r, 400));
            }
          }
        }
      } catch {}

      const total = azure + aws + mongodb + gcp;
      return res.json({ currency: 'USD', azure, aws, mongodb, gcp, total, start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) });
    } catch (err) {
      return res.status(500).json({ message: 'Failed to compute total MTD (USD)' });
    }
  });

  app.post("/api/refresh-cost-data", async (req, res) => {
    try {
      const spns = await storage.getServicePrincipals();
      const activeSpns = spns.filter(spn => spn.status === "active");
      
      if (activeSpns.length === 0) {
        return res.json({ success: false, message: "No active service principals found" });
      }
      
      // Fetch cost data based on provider type
      for (const spn of activeSpns) {
        if (spn.provider === 'azure') {
          await fetchAzureCostData(spn);
        } else if (spn.provider === 'mongodb') {
          await fetchMongoDBAtlasCostData(spn);
        }
        await storage.updateServicePrincipal(spn.id, { lastSync: new Date() });
      }
      
      // Update cost summary
      await updateCostSummary();
      
      res.json({ success: true, message: "Cost data refreshed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to refresh cost data" });
    }
  });

  // MongoDB Month-to-Date (USD) via two-step curl (uses env secrets; no secrets returned)
  app.get("/api/mongodb/mtd-usage", async (_req, res) => {
    try {
      // Compute month boundaries in UTC to satisfy CE requirement (first of month)
      const now = new Date();
      const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const endNextUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const startStr = startUTC.toISOString().slice(0, 10);
      const endStr = endNextUTC.toISOString().slice(0, 10);

      // Try pure Node digest flow first (no bash)
      try {
        const publicKey = process.env.MONGODB_PUBLIC_KEY;
        const privateKey = process.env.MONGODB_PRIVATE_KEY;
        const orgId = process.env.MONGODB_ORG_ID;
        if (!publicKey || !privateKey || !orgId) {
          return res.status(400).json({ message: "MongoDB credentials not configured" });
        }

        const digest = new DigestFetch(publicKey, privateKey);
        const initUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${orgId}/billing/costExplorer/usage`;
        const initBody = {
          startDate: startStr,
          endDate: endStr,
          organizations: [orgId],
          groupBy: "organizations",
        } as const;

        const initResp = await digest.fetch(initUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.atlas.2023-01-01+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(initBody),
        });

        let token = initResp.headers.get('Location') || initResp.headers.get('location') || '';
        if (token) {
          token = (token.split('/').pop() || '').trim();
        }
        if (!token) {
          const initText = await initResp.text();
          try {
            const maybe = JSON.parse(initText);
            token = (maybe.token || maybe.id || maybe.usageId || '').toString();
          } catch {
            token = initText.replace(/\"/g, '').trim();
          }
        }
        if (token) {
          const resultUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${orgId}/billing/costExplorer/usage/${token}`;
          let usageData: any = null;
          for (let attempt = 0; attempt < 12; attempt++) {
            const r = await digest.fetch(resultUrl, {
              method: 'GET',
              headers: { 'Accept': 'application/vnd.atlas.2023-01-01+json' },
            });
            const t = await r.text();
            try {
              const p = JSON.parse(t || '{}');
              const status = (p.status || p.state || p.phase || '').toString().toUpperCase();
              if (status.includes('IN_PROGRESS') || status.includes('PENDING')) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
              }
              usageData = p;
              break;
            } catch {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          if (!usageData) {
            return res.status(502).json({ message: "Cost Explorer result not ready" });
          }
          let usageAmountNum = 0;
          if (Array.isArray(usageData.usageDetails)) {
            usageAmountNum = usageData.usageDetails.reduce((s: number, d: any) => s + (Number(d.usageAmount) || 0), 0);
          } else if (typeof usageData.usageAmount === 'number') {
            usageAmountNum = usageData.usageAmount;
          }
          return res.json({ currency: "USD", usageAmount: usageAmountNum.toFixed(2) });
        }
      } catch {}

      // Execute the exact two-step flow in a bash subshell that sources .env
      const bashFlow = [
        "set -euo pipefail;",
        ":",
        "HDR_A='Accept: application/vnd.atlas.2023-01-01+json';",
        "HDR_C='Content-Type: application/json';",
        "INIT_URL=\"https://cloud.mongodb.com/api/atlas/v2/orgs/$MONGODB_ORG_ID/billing/costExplorer/usage\";",
        "INIT_DATA=$(printf '{\"startDate\":\"%s\",\"endDate\":\"%s\",\"organizations\":[\"%s\"],\"groupBy\":\"organizations\"}' \"$START\" \"$END\" \"$MONGODB_ORG_ID\");",
        // First curl
        "OUT=$(curl --digest -u \"$MONGODB_PUBLIC_KEY:$MONGODB_PRIVATE_KEY\" -sS -D - -o /dev/null -H \"$HDR_A\" -H \"$HDR_C\" --request POST --data \"$INIT_DATA\" \"$INIT_URL\");",
        // Extract token from Location or JSON
        "TOKEN=$(printf %s \"$OUT\" | awk 'BEGIN{IGNORECASE=1} /^Location:/ {print $2}' | tail -n1 | sed -E 's#.*/usage/([^[:space:]]+).*#\\1#');",
        "if [ -z \"$TOKEN\" ]; then TOKEN=$(printf %s \"$OUT\" | sed -nE 's/.*\\\"token\\\"[[:space:]]*:[[:space:]]*\\\"([A-Za-z0-9]+)\\\".*/\\1/p' | tail -n1); fi;",
        "if [ -z \"$TOKEN\" ]; then echo '{\\\"error\\\":\\\"NO_TOKEN\\\"}'; exit 10; fi;",
        // Second curl (poll up to 12 times)
        "RESULT_URL=\"https://cloud.mongodb.com/api/atlas/v2/orgs/$MONGODB_ORG_ID/billing/costExplorer/usage/$TOKEN\";",
        "for i in $(seq 1 12); do R=$(curl --digest -u \"$MONGODB_PUBLIC_KEY:$MONGODB_PRIVATE_KEY\" -sS -H \"$HDR_A\" \"$RESULT_URL\"); S=$(printf %s \"$R\" | sed -nE 's/.*\\\"(status|state|phase)\\\"[[:space:]]*:[[:space:]]*\\\"?([A-Za-z_]+)\\\"?.*/\\2/p' | tr '[:lower:]' '[:upper:]' | head -n1); if [ -z \"$S\" ] || [ \"$S\" = \"COMPLETED\" ] || [ \"$S\" = \"READY\" ]; then echo \"$R\"; exit 0; fi; sleep 1; done;",
        "echo '{\\\"error\\\":\\\"NOT_READY\\\"}'; exit 11;"
      ].join(' ');

      console.log('[CE] starting bashFlow');
      const { stdout: flowOut, stderr: flowErr } = await execFileAsync("bash", ["-lc", bashFlow], {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          MONGODB_PUBLIC_KEY: process.env.MONGODB_PUBLIC_KEY || "",
          MONGODB_PRIVATE_KEY: process.env.MONGODB_PRIVATE_KEY || "",
          MONGODB_ORG_ID: process.env.MONGODB_ORG_ID || "",
          START: startStr,
          END: endStr,
        },
        maxBuffer: 2 * 1024 * 1024,
      });
      if (flowErr) {
        console.log(`[CE] bashFlow stderr:`, flowErr.slice(0, 400).replace(/\n/g, ' '));
      }
      console.log(`[CE] bashFlow out head:`, (flowOut || '').slice(0, 200).replace(/\n/g, ' '));
      let usageData: any = {};
      try {
        usageData = JSON.parse(flowOut.trim());
      } catch {}
      if (!usageData || usageData.error === 'NO_TOKEN' || usageData.error === 'NOT_READY') {
        console.log('[CE] falling back to helper script');
        // Fallback: call helper script directly (proven working) with .env creds
        const pk = process.env.MONGODB_PUBLIC_KEY;
        const sk = process.env.MONGODB_PRIVATE_KEY;
        const org = process.env.MONGODB_ORG_ID;
        if (!pk || !sk || !org) {
          return res.status(400).json({ message: "MongoDB credentials not configured" });
        }
        try {
          const scriptPath = path.resolve(__dirname, "..", "scripts", "fetch_mongo_cost.sh");
          const { stdout: scriptOut, stderr: scriptErr } = await execFileAsync("bash", [scriptPath, pk, sk, org, startStr, endStr], { maxBuffer: 2 * 1024 * 1024 });
          if (scriptErr) {
            console.log(`[CE] helper script stderr:`, scriptErr.slice(0, 400).replace(/\n/g, ' '));
          }
          console.log(`[CE] helper script out head:`, (scriptOut || '').slice(0, 200).replace(/\n/g, ' '));
          const jsonStr = scriptOut.split("\n").filter((l) => l.trim().startsWith("{")).pop() || "{}";
          usageData = JSON.parse(jsonStr);
        } catch {
          return res.status(502).json({ message: "Failed to obtain Cost Explorer token" });
        }
      }

      let usageAmountNum = 0;
      if (Array.isArray(usageData.usageDetails)) {
        usageAmountNum = usageData.usageDetails.reduce((s: number, d: any) => s + (Number(d.usageAmount) || 0), 0);
      } else if (typeof usageData.usageAmount === 'number') {
        usageAmountNum = usageData.usageAmount;
      }

      console.log(`[CE] success usageAmount USD:`, usageAmountNum.toFixed(2));
      return res.json({ currency: "USD", usageAmount: usageAmountNum.toFixed(2) });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch MongoDB MTD usage" });
    }
  });

  // Two-step endpoints for MongoDB CE using .env creds
  app.post("/api/mongodb/ce-init", async (_req, res) => {
    try {
      const orgId = process.env.MONGODB_ORG_ID as string | undefined;
      if (!orgId) return res.status(400).json({ message: "MongoDB credentials not configured" });

      const nowMs = Date.now();
      const cached = ceCacheByOrg[orgId];
      if (cached && cached.token && (nowMs - cached.tokenAtMs) < CE_TOKEN_TTL_MS) {
        return res.json({ token: cached.token });
      }

      const publicKey = process.env.MONGODB_PUBLIC_KEY;
      const privateKey = process.env.MONGODB_PRIVATE_KEY;
      if (!publicKey || !privateKey || !orgId) {
        return res.status(400).json({ message: "MongoDB credentials not configured" });
      }

      const now = new Date();
      const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const endNextUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const startStr = startUTC.toISOString().slice(0, 10);
      const endStr = endNextUTC.toISOString().slice(0, 10);

      const initUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${orgId}/billing/costExplorer/usage`;
      const initBody = JSON.stringify({
        startDate: startStr,
        endDate: endStr,
        organizations: [orgId],
        groupBy: "organizations",
      });

      const { stdout: initOut } = await execFileAsync("curl", [
        "--digest",
        "-u", `${publicKey}:${privateKey}`,
        "--include",
        "-sS",
        "-H", "Accept: application/vnd.atlas.2023-01-01+json",
        "-H", "Content-Type: application/json",
        "--request", "POST",
        "--data", initBody,
        initUrl,
      ], { maxBuffer: 2 * 1024 * 1024 });

      let token = "";
      const bodyPart = initOut.split(/\r?\n\r?\n/).pop() || "";
      const mBody = bodyPart.match(/\"token\"\s*:\s*\"([A-Za-z0-9]+)\"/);
      if (mBody) token = mBody[1];
      if (!token) {
        const locLines = initOut.match(/^location:\s*.*$/gmi);
        if (locLines && locLines.length > 0) {
          const locUrl = locLines[locLines.length - 1].replace(/^location:\s*/i, "").trim();
          const mLoc = locUrl.match(/\/usage\/([^\s]+)/);
          if (mLoc) token = mLoc[1].replace(/\r|\n/g, "");
        }
      }
      if (!token) return res.status(502).json({ message: "Failed to obtain Cost Explorer token" });
      ceCacheByOrg[orgId] = {
        token,
        usageAmount: cached?.usageAmount ?? null,
        cachedAtMs: cached?.cachedAtMs ?? 0,
        tokenAtMs: nowMs,
      };
      return res.json({ token });
    } catch (err) {
      return res.status(500).json({ message: "Failed to initialize Cost Explorer" });
    }
  });

  app.get("/api/mongodb/ce-usage/:token", async (req, res) => {
    try {
      const publicKey = process.env.MONGODB_PUBLIC_KEY;
      const privateKey = process.env.MONGODB_PRIVATE_KEY;
      const orgId = process.env.MONGODB_ORG_ID;
      const token = req.params.token;
      if (!publicKey || !privateKey || !orgId || !token) {
        return res.status(400).json({ message: "Missing credentials or token" });
      }

      const nowMs = Date.now();
      const cached = ceCacheByOrg[orgId];
      if (cached && cached.usageAmount !== null && (nowMs - cached.cachedAtMs) < CE_USAGE_TTL_MS) {
        return res.json({ currency: "USD", usageAmount: cached.usageAmount.toFixed(2), cached: true });
      }

      const resultUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${orgId}/billing/costExplorer/usage/${token}`;
      let usageData: any = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const { stdout } = await execFileAsync("curl", [
          "--digest",
          "-u", `${publicKey}:${privateKey}`,
          "-sS",
          "-H", "Accept: application/vnd.atlas.2023-01-01+json",
          resultUrl,
        ], { maxBuffer: 2 * 1024 * 1024 });
        try {
          const parsed = JSON.parse(stdout || "{}");
          const status = (parsed.status || parsed.state || parsed.phase || "").toString().toUpperCase();
          if (status.includes("IN_PROGRESS") || status.includes("PENDING")) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          usageData = parsed;
          break;
        } catch {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!usageData) return res.status(502).json({ message: "Cost Explorer result not ready" });

      let usageAmountNum = 0;
      if (Array.isArray(usageData.usageDetails)) {
        usageAmountNum = usageData.usageDetails.reduce((s: number, d: any) => s + (Number(d.usageAmount) || 0), 0);
      } else if (typeof usageData.usageAmount === 'number') {
        usageAmountNum = usageData.usageAmount;
      }
      ceCacheByOrg[orgId] = {
        token,
        usageAmount: usageAmountNum,
        cachedAtMs: nowMs,
        tokenAtMs: cached?.tokenAtMs ?? nowMs,
      };
      return res.json({ currency: "USD", usageAmount: usageAmountNum.toFixed(2) });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch Cost Explorer usage" });
    }
  });

  // (moved AWS routes to server/aws.ts)

  // MongoDB clusters list (project-scoped)
  app.get("/api/mongodb/clusters", async (_req, res) => {
    try {
      const publicKey = process.env.MONGODB_PUBLIC_KEY;
      const privateKey = process.env.MONGODB_PRIVATE_KEY;
      const projectId = process.env.MONGODB_PROJECT_ID; // require project id
      if (!publicKey || !privateKey || !projectId) {
        return res.status(400).json({ message: "MongoDB credentials or project not configured" });
      }

      const url = `https://cloud.mongodb.com/api/atlas/v2/groups/${projectId}/clusters`;
      const { stdout } = await execFileAsync("curl", [
        "--digest",
        "-u", `${publicKey}:${privateKey}`,
        "-sS",
        "-H", "Accept: application/vnd.atlas.2023-01-01+json",
        url,
      ], { maxBuffer: 2 * 1024 * 1024 });
      const data = JSON.parse(stdout || '{}');
      const clusters = Array.isArray(data.results) ? data.results.map((c: any) => ({
        name: c.name,
        clusterType: c.clusterType,
        cloudProvider: c.providerSettings?.providerName || c.cloudProvider || 'unknown',
        region: c.providerSettings?.regionName || c.region || 'unknown',
        stateName: c.stateName,
      })) : [];
      return res.json({ clusters });
    } catch {
      return res.status(500).json({ message: "Failed to fetch MongoDB clusters" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Real Azure API integration functions
async function testAzureConnection(spn: any): Promise<void> {
  try {
    if (!spn.clientId || !spn.tenantId || !spn.clientSecret) {
      throw new Error("Missing required Azure credentials");
    }
    
    const credential = new ClientSecretCredential(
      spn.tenantId,
      spn.clientId,
      spn.clientSecret
    );
    
    const costManagementClient = new CostManagementClient(credential, spn.subscriptionId);
    
    // Test the connection by trying to get subscription info
    await costManagementClient.dimensions.list(
      `/subscriptions/${spn.subscriptionId}`,
      {
        filter: "properties/category eq 'ResourceGroup'"
      }
    );
  } catch (error) {
    console.error('Azure connection test failed:', error);
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fetchAzureCostData(spn: any): Promise<void> {
  try {
    console.log(`🔍 Fetching real Azure cost data for SPN: ${spn.name}`);
    console.log(`🔑 Azure credentials: clientId=${spn.clientId?.substring(0,8)}..., subscriptionId=${spn.subscriptionId}`);
    
    if (!spn.clientId || !spn.tenantId || !spn.clientSecret) {
      throw new Error("Missing required Azure credentials");
    }
    
    const credential = new ClientSecretCredential(
      spn.tenantId,
      spn.clientId,
      spn.clientSecret
    );
    
    const costManagementClient = new CostManagementClient(credential, spn.subscriptionId);
    
    // Define query for last 30 days cost data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    const queryDefinition = {
      type: "Usage",
      timeframe: "Custom",
      timePeriod: {
        from: startDate,
        to: endDate
      },
      dataset: {
        granularity: "Daily",
        aggregation: {
          totalCost: {
            name: "PreTaxCost",
            function: "Sum"
          }
        },
        grouping: [
          {
            type: "Dimension",
            name: "ResourceGroup"
          },
          {
            type: "Dimension",
            name: "ServiceName"
          },
          {
            type: "Dimension",
            name: "ResourceLocation"
          }
        ]
      }
    };
    
    const scope = `/subscriptions/${spn.subscriptionId}`;
    console.log(`📊 Querying Azure Cost Management API for scope: ${scope}`);
    const result = await costManagementClient.query.usage(scope, queryDefinition);
    
    console.log(`📈 Azure API returned ${result?.rows?.length || 0} cost entries`);
    
    if (result && result.rows) {
      // Process and store the cost data
      const costEntries = [];
      
      for (const row of result.rows) {
        // Correct order: [cost, date, resourceGroup, serviceName, location, currency]
        const [cost, date, resourceGroup, serviceName, location, currency] = row;
        
        // DEBUG: Log raw Azure API response to check actual values
        console.log(`🔍 Azure API Raw Data: cost=${cost}, currency=${currency}, date=${date}, service=${serviceName}`);
        
        // Parse YYYYMMDD date format
        const dateStr = date.toString();
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substring(6, 8));
        const parsedDate = new Date(year, month, day);
        
        // Normalize Azure costs to USD for storage
        const rawCost = Number(cost);
        let dailyCostUsd = rawCost;
        const inrToUsd = Number(process.env.AZURE_INR_TO_USD_RATE || "0.012" /* ~1/83.5 */);
        if ((currency as string) === 'INR') {
          dailyCostUsd = rawCost * inrToUsd;
          console.log(`💱 INR→USD: ${rawCost} INR → ${dailyCostUsd} USD (rate ${inrToUsd})`);
        } else if ((currency as string) === 'USD') {
          dailyCostUsd = rawCost;
          console.log(`💵 Already in USD: ${dailyCostUsd} USD`);
        } else {
          // Fallback: treat as INR and convert
          dailyCostUsd = rawCost * inrToUsd;
          console.log(`❓ Unknown currency ${currency}, converting as INR → USD: ${dailyCostUsd} USD`);
        }
        
        const costEntry = {
          providerId: spn.id,
          provider: "azure",
          date: parsedDate,
          resourceGroup: resourceGroup as string,
          serviceName: serviceName as string,
          location: location as string,
          dailyCost: dailyCostUsd.toFixed(2),
          monthlyCost: null, // Monthly totals are computed in summaries
          currency: "USD",
          metadata: null
        };
        
        costEntries.push(costEntry);
      }
      
      // Bulk insert cost data
      if (costEntries.length > 0) {
        await storage.bulkCreateCostData(costEntries);
      }
      
      console.log(`Fetched ${costEntries.length} cost entries for ${spn.name}`);
    }
  } catch (error) {
    console.error(`❌ AZURE API ERROR for ${spn.name}:`, error);
    throw error;
  }
}

// MongoDB Atlas API integration functions
async function testMongoDBAtlasConnection(spn: any): Promise<void> {
  try {
    if (!spn.publicKey || !spn.privateKey || !spn.orgId) {
      throw new Error("Missing required MongoDB Atlas credentials");
    }

    // Test connection to MongoDB Atlas API
    const auth = Buffer.from(`${spn.publicKey}:${spn.privateKey}`).toString('base64');
    const response = await axios.get(`https://cloud.mongodb.com/api/atlas/v2/groups/${spn.projectId || spn.orgId}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/vnd.atlas.2025-03-12+json'
      }
    });
    
    if (response.status !== 200) {
      throw new Error('Failed to authenticate with MongoDB Atlas');
    }
  } catch (error) {
    console.error('MongoDB Atlas connection test failed:', error);
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fetchMongoDBAtlasCostData(spn: any): Promise<void> {
  try {
    console.log(`Fetching real MongoDB Atlas cost data for: ${spn.name}`);
    // Always clear previous MongoDB entries first to avoid showing stale/mock data
    await storage.clearCostDataByProviderType('mongodb');
    
    if (!spn.publicKey || !spn.privateKey || !spn.orgId) {
      throw new Error("Missing required MongoDB Atlas credentials");
    }

    // Use real MongoDB Atlas API with digest authentication
    // Build date range for MTD (Cost Explorer uses next-month end)
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    // Prefer Cost Explorer via curl (exact flow): POST to get token from Location header, then GET usage with token
    try {
      const ceStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      const ceEndNext = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);
      const ceStartStr = ceStart.toISOString().slice(0, 10);
      const ceEndStr = ceEndNext.toISOString().slice(0, 10);

      const initUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${spn.orgId}/billing/costExplorer/usage`;
      const initBody = JSON.stringify({
        startDate: ceStartStr,
        endDate: ceEndStr,
        organizations: [spn.orgId],
        groupBy: "organizations",
      });

      const curlInitArgs = [
        "--digest",
        "-u",
        `${spn.publicKey}:${spn.privateKey}`,
        "--include",
        "-H",
        "Accept: application/vnd.atlas.2023-01-01+json",
        "-H",
        "Content-Type: application/json",
        "--request",
        "POST",
        "--data",
        initBody,
        initUrl,
      ];
      console.log(`🔎 CE curl init ${ceStartStr}..${ceEndStr}`);
      const { stdout: initStdout } = await execFileAsync("curl", curlInitArgs, { maxBuffer: 1024 * 1024 });
      const parts = initStdout.split("\r\n\r\n");
      const headersText = parts[0] || "";
      const bodyText = parts.slice(1).join("\r\n\r\n");
      const locMatch = headersText.match(/^Location:\s*(.*)$/mi);
      let token = "";
      if (locMatch && locMatch[1]) {
        const locUrl = locMatch[1].trim();
        const m = locUrl.match(/\/usage\/([^\s]+)/);
        if (m) token = m[1].replace(/\r|\n/g, "");
      }
      if (!token && bodyText) {
        try {
          const maybe = JSON.parse(bodyText);
          token = (maybe.token || maybe.id || maybe.usageId || "").toString();
        } catch {}
      }
      if (!token) throw new Error("CE token not found from curl");

      const resUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${spn.orgId}/billing/costExplorer/usage/${token}`;
      console.log(`🔎 CE curl fetch token ${token}`);
      let usageData: any = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const { stdout: resStdout } = await execFileAsync("curl", [
          "--digest",
          "-u",
          `${spn.publicKey}:${spn.privateKey}`,
          "-H",
          "Accept: application/vnd.atlas.2023-01-01+json",
          resUrl,
        ], { maxBuffer: 2 * 1024 * 1024 });
        try {
          const parsed = JSON.parse(resStdout || "{}");
          const status = (parsed.status || parsed.state || parsed.phase || "").toString().toUpperCase();
          if (status.includes("IN_PROGRESS") || status.includes("PENDING")) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          usageData = parsed;
          break;
        } catch {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!usageData) throw new Error("CE curl result not ready");

      const sumUsd = (node: any): number => {
        if (!node) return 0;
        if (Array.isArray(node)) return node.reduce((s, n) => s + sumUsd(n), 0);
        if (typeof node === 'object') {
          let s = 0;
          if (typeof (node as any).amountUsd === 'number') s += (node as any).amountUsd;
          if (typeof (node as any).totalAmountUsd === 'number') s += (node as any).totalAmountUsd;
          if (typeof (node as any).amount === 'number' && (((node as any).currency === 'USD') || ((node as any).unit === 'USD'))) s += (node as any).amount;
          for (const k of Object.keys(node)) s += sumUsd((node as any)[k]);
          return s;
        }
        return 0;
      };
      const totalUsd = sumUsd(usageData);
      console.log(`💵 CE curl MTD total USD: ${totalUsd.toFixed(2)}`);
      if (totalUsd > 0) {
        await storage.createCostData({
          providerId: spn.id,
          provider: 'mongodb',
          date: new Date(),
          clusterName: 'All Clusters',
          serviceType: 'MongoDB MTD (CostExplorer)',
          dailyCost: null,
          monthlyCost: totalUsd.toFixed(2),
          currency: 'USD',
          region: 'global',
          resourceGroup: null,
          serviceName: null,
          location: null,
          databaseName: null,
          metadata: { source: 'cost_explorer_curl', token }
        });
        console.log('✅ CE curl stored MTD USD');
        return;
      }
    } catch (e) {
      console.log('ℹ️ CostExplorer curl path failed or returned 0, trying usage/invoices');
    }

    // 1) Prefer Cost Explorer two-step flow (token + fetch usage) for authoritative USD MTD
    try {
      const ceStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      const ceEndNext = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);
      const ceStartStr = ceStart.toISOString().slice(0, 10);
      const ceEndStr = ceEndNext.toISOString().slice(0, 10);

      const digestForCE = new DigestFetch(spn.publicKey, spn.privateKey);
      const initUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${spn.orgId}/billing/costExplorer/usage`;
      const initBody = {
        startDate: ceStartStr,
        endDate: ceEndStr,
        organizations: [spn.orgId],
        groupBy: "organizations",
      } as const;

      console.log(`🔎 CostExplorer: init ${ceStartStr}..${ceEndStr}`);
      const initResp = await digestForCE.fetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.atlas.2023-01-01+json',
        },
        body: JSON.stringify(initBody),
      });
      if (!initResp.ok) {
        const t = await initResp.text();
        console.log(`❌ CE init ${initResp.status} :: ${t.slice(0,300)}`);
        throw new Error('CE init failed');
      }
      // Token is typically returned via Location header; body may be empty
      const locHeader = initResp.headers.get('Location') || initResp.headers.get('location') || '';
      let token = '';
      if (locHeader) {
        token = locHeader.split('/').pop() || '';
      }
      if (!token) {
        const tokenText = await initResp.text();
        try {
          const maybe = JSON.parse(tokenText);
          token = (maybe.token || maybe.id || maybe.usageId || '').toString();
        } catch {
          token = tokenText.replace(/\"/g, '').replace(/"/g, '').trim();
        }
      }
      if (!token) {
        throw new Error('CE token not found');
      }

      const resUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${spn.orgId}/billing/costExplorer/usage/${token}`;
      console.log(`🔎 CostExplorer: fetch token ${token}`);
      let usageData: any = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const resResp = await digestForCE.fetch(resUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/vnd.atlas.2023-01-01+json' },
        });
        const bodyText = await resResp.text();
        if (!resResp.ok) {
          console.log(`❌ CE result ${resResp.status} :: ${bodyText.slice(0,300)}`);
          throw new Error('CE result failed');
        }
        try {
          const parsed = JSON.parse(bodyText);
          // If response indicates in-progress, wait and retry
          const status = (parsed.status || parsed.state || parsed.phase || '').toString().toUpperCase();
          if (status.includes('IN_PROGRESS') || status.includes('PENDING')) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          usageData = parsed;
          break;
        } catch {
          // Not JSON (unlikely), wait and retry
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!usageData) {
        throw new Error('CE result not ready after retries');
      }
      console.log('CE result (trim):', JSON.stringify(usageData).slice(0,600));

      const sumUsd = (node: any): number => {
        if (!node) return 0;
        if (Array.isArray(node)) return node.reduce((s, n) => s + sumUsd(n), 0);
        if (typeof node === 'object') {
          let s = 0;
          if (typeof node.amountUsd === 'number') s += node.amountUsd;
          if (typeof node.totalAmountUsd === 'number') s += node.totalAmountUsd;
          if (typeof node.amount === 'number' && (node.currency === 'USD' || node.unit === 'USD')) s += node.amount;
          for (const k of Object.keys(node)) s += sumUsd(node[k]);
          return s;
        }
        return 0;
      };

      const totalUsd = sumUsd(usageData);
      console.log(`💵 CE MTD total USD: ${totalUsd.toFixed(2)}`);
      if (totalUsd > 0) {
        await storage.createCostData({
          providerId: spn.id,
          provider: 'mongodb',
          date: new Date(),
          clusterName: 'All Clusters',
          serviceType: 'MongoDB MTD (CostExplorer)',
          dailyCost: null,
          monthlyCost: totalUsd.toFixed(2),
          currency: 'USD',
          region: 'global',
          resourceGroup: null,
          serviceName: null,
          location: null,
          databaseName: null,
          metadata: { source: 'cost_explorer', token }
        });
        console.log('✅ CE stored MTD USD');
        return;
      }
    } catch (e) {
      console.log('ℹ️ CostExplorer not available or returned 0, trying usage/invoices');
    }

    const endpoints = [
      // Daily usage costs by org (preferred for MTD in USD)
      `https://cloud.mongodb.com/api/atlas/v2/orgs/${spn.orgId}/usage/costs?granularity=DAILY&startDate=${startStr}&endDate=${endStr}`,
      // Daily usage costs by project as fallback when org scope restricted
      (spn.projectId ? `https://cloud.mongodb.com/api/atlas/v2/groups/${spn.projectId}/usage/costs?granularity=DAILY&startDate=${startStr}&endDate=${endStr}` : null),
      `https://cloud.mongodb.com/api/atlas/v2/groups/${spn.projectId}/clusters`, // This worked before
      `https://cloud.mongodb.com/api/atlas/v1.0/groups/${spn.projectId}/clusters`,
      `https://cloud.mongodb.com/api/atlas/v1.0/groups/${spn.projectId}`,
      `https://cloud.mongodb.com/api/atlas/v1.0/orgs/${spn.orgId}/invoices/pending`
    ].filter(Boolean) as string[];
    
    // Use proper MongoDB Atlas API authentication
    const auth = `${spn.publicKey}:${spn.privateKey}`;
    const encodedAuth = Buffer.from(auth).toString('base64');
    
    let successfulResponse = null;
    
    // Try different endpoints to find one that works using proper digest auth
    const digestFetch = new DigestFetch(spn.publicKey, spn.privateKey);
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying MongoDB Atlas API endpoint: ${endpoint}`);
        const response = await digestFetch.fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.atlas.2023-01-01+json',
            'User-Agent': 'Replit-Cost-Dashboard/1.0'
          }
        });

        if (response.ok) {
          if (endpoint.includes('/usage/costs') || endpoint.includes('/invoices')) {
          successfulResponse = response;
            console.log(`✅ MongoDB Atlas API success with COST endpoint: ${endpoint}`);
          break;
          } else {
            console.log(`✅ MongoDB Atlas API success with NON-COST endpoint (ignored for costs): ${endpoint}`);
          }
        } else {
          const body = await response.text();
          console.log(`❌ MongoDB Atlas API failed with ${response.status} for endpoint: ${endpoint} :: ${body.slice(0,300)}`);
        }
      } catch (err) {
        console.log(`❌ MongoDB Atlas API error for endpoint ${endpoint}:`, err);
        continue;
      }
    }

    if (!successfulResponse) {
      // Try with Basic auth as fallback for COST endpoints only
      console.log("Trying with Basic authentication as fallback...");
      for (const endpoint of endpoints) {
        if (!endpoint.includes('/usage/costs') && !endpoint.includes('/invoices')) continue;
      try {
          const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${encodedAuth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.atlas.2023-01-01+json'
          }
        });
        if (response.ok) {
          successfulResponse = response;
            console.log(`✅ MongoDB Atlas API success with Basic auth COST endpoint: ${endpoint}`);
            break;
        } else {
            console.log(`❌ MongoDB Atlas API Basic auth failed with ${response.status} for ${endpoint}`);
          }
        } catch (err) {
          console.log(`❌ MongoDB Atlas API Basic auth error for ${endpoint}:`, err);
          continue;
        }
      }
    }

    if (!successfulResponse) {
      console.log(`MongoDB API failed for all endpoints for org ${spn.orgId}. No data stored.`);
        return;
      }

      const data = await successfulResponse.json();
      console.log('MongoDB Atlas API Response:', JSON.stringify(data, null, 2));
      
      // Process real MongoDB data (clusters, usage, etc.)
      const costEntries = [] as any[];
      
      // Handle different response formats based on endpoint
      if (data.results && Array.isArray(data.results)) {
        // costs usage or clusters/billing data
        for (const item of data.results) {
          // Daily usage costs format (v2 usage API)
          if (item.date && (item.amountUsd !== undefined || item.amount !== undefined || item.amountCents !== undefined)) {
            const amountUsd = item.amountUsd ?? (item.amountCents !== undefined ? item.amountCents / 100 : item.amount);
            const usageDate = new Date(item.date);
            costEntries.push({
              providerId: spn.id,
              provider: "mongodb",
              date: usageDate,
              clusterName: item.projectName || item.orgName || "MongoDB Usage",
              serviceType: item.product || "Usage Cost",
              dailyCost: Number(amountUsd).toFixed(2),
              currency: "USD",
              region: item.cloudProvider || item.region || "global",
              metadata: {
                scope: item.groupId ? "project" : "org",
                groupId: item.groupId || null,
                orgId: spn.orgId,
              }
            });
            continue;
          }
          if (item.lineItems) {
            // Billing data from invoices
            for (const lineItem of item.lineItems) {
              const costUSD = parseFloat(lineItem.totalPriceCents || 0) / 100;
              
              costEntries.push({
                providerId: spn.id,
                provider: "mongodb",
                date: new Date(),
                clusterName: lineItem.clusterName || "Unknown Cluster",
                serviceType: lineItem.sku || "Atlas Service",
                dailyCost: costUSD.toString(),
                currency: "USD",
                region: lineItem.cloudProvider || "Unknown",
                metadata: {
                  orgId: spn.orgId,
                  projectId: spn.projectId,
                  sku: lineItem.sku,
                  cloudProvider: lineItem.cloudProvider
                }
              });
            }
          }
        }
      }

      // Only save if there are cost entries
      if (costEntries.length > 0) {
        await storage.clearCostDataByProviderType('mongodb');
      for (const entry of costEntries) {
        await storage.createCostData(entry);
        }
        console.log(`Fetched ${costEntries.length} real MongoDB cost entries for ${spn.name}`);
      } else {
        console.log(`ℹ️ No MongoDB cost entries returned by usage/invoice APIs for ${spn.name}`);
      }
      
  } catch (error) {
    console.error(`Failed to fetch MongoDB Atlas cost data for ${spn.name}:`, error);
    throw error;
  }
}

async function updateCostSummary(): Promise<void> {
  try {
    const costData = await storage.getCostData();
    
    if (costData.length === 0) {
      console.log('No cost data available to create summary');
      return;
    }
    
    // Calculate summary metrics in USD uniformly
    const providerMonthlyUsd = costData.reduce((acc: Record<string, number>, e) => {
      const daily = e.dailyCost ? parseFloat(e.dailyCost) : 0;
      const monthly = e.monthlyCost ? parseFloat(e.monthlyCost) : 0;
      const amount = monthly || daily; // daily already normalized to USD above for Azure; others use their native USD
      const key = e.provider || 'unknown';
      acc[key] = (acc[key] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    const totalMonthlyCost = Object.values(providerMonthlyUsd).reduce((s, n) => s + n, 0);
    
    // Get today's costs only
    const today = new Date();
    const todaySpend = costData
      .filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.toDateString() === today.toDateString();
      })
      .reduce((sum, entry) => {
        return sum + (parseFloat(entry.dailyCost || "0"));
      }, 0);
    
    const activeResources = new Set(costData.map(entry => entry.resourceGroup || entry.serviceName || entry.clusterName)).size;
    
    // Service breakdown - sum daily costs by service
    const serviceBreakdown: Record<string, number> = {};
    costData.forEach(entry => {
      const service = entry.serviceName || entry.clusterName || "Unknown";
      const cost = parseFloat(entry.dailyCost || "0");
      serviceBreakdown[service] = (serviceBreakdown[service] || 0) + cost;
    });
    
    // Calculate real trend data from historical data
    const trendData = await calculateRealTrendData(costData);
    
    const summaryData = {
      date: new Date(),
      totalMonthlyCost: totalMonthlyCost.toFixed(2),
      todaySpend: todaySpend.toFixed(2),
      activeResources: activeResources.toString(),
      budgetUtilization: null, // Real budget data not available from Azure Cost API
      trendData,
      serviceBreakdown
    };
    
    await storage.createCostSummary(summaryData);
    console.log('Cost summary updated successfully');
  } catch (error) {
    console.error('Failed to update cost summary:', error);
  }
}
