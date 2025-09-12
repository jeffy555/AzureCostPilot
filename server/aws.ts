import type { Express } from "express";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

export async function registerAwsRoutes(app: Express) {
  app.get("/api/aws/test-connection", async (_req, res) => {
    try {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const sessionToken = process.env.AWS_SESSION_TOKEN;
      const region = process.env.AWS_REGION || "us-east-1";
      if (!accessKeyId || !secretAccessKey) {
        return res.status(400).json({ message: "AWS credentials not configured" });
      }

      const creds = { accessKeyId, secretAccessKey, sessionToken } as const;
      const sts = new STSClient({ region, credentials: creds });
      const id = await sts.send(new GetCallerIdentityCommand({}));

      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

      const ce = new CostExplorerClient({ region: "us-east-1", credentials: creds });
      const ceResp = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      }));
      const amount = ceResp.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount || "0";
      const unit = ceResp.ResultsByTime?.[0]?.Total?.UnblendedCost?.Unit || "USD";

      return res.json({
        identity: { account: id.Account, arn: id.Arn, userId: id.UserId },
        costExplorer: { start, end, amount, unit },
      });
    } catch (err) {
      return res.status(500).json({ message: "Failed to connect to AWS", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // AWS Month-to-Date cost breakdown by SERVICE (monthly sum and daily count)
  app.get("/api/aws/mtd-services", async (_req, res) => {
    try {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const sessionToken = process.env.AWS_SESSION_TOKEN;
      if (!accessKeyId || !secretAccessKey) {
        return res.status(400).json({ message: "AWS credentials not configured" });
      }

      const creds = { accessKeyId, secretAccessKey, sessionToken } as const;
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

      const ce = new CostExplorerClient({ region: "us-east-1", credentials: creds });
      const ceResp = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      }));

      const totalsByService: Record<string, number> = {};
      let total = 0;
      const days = Math.max(1, (ceResp.ResultsByTime ?? []).length);
      for (const day of ceResp.ResultsByTime ?? []) {
        for (const g of day.Groups ?? []) {
          const key = g.Keys?.[0] || "Unknown";
          const amt = parseFloat(g.Metrics?.UnblendedCost?.Amount || "0");
          totalsByService[key] = (totalsByService[key] || 0) + amt;
          total += amt;
        }
      }
      const services = Object.entries(totalsByService)
        .sort((a, b) => b[1] - a[1])
        .map(([service, amount]) => ({ service, amount }));
      return res.json({ currency: "USD", start, end, days, total, services });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch AWS MTD services", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // AWS Month-to-Date cost breakdown by REGION
  app.get("/api/aws/mtd-regions", async (_req, res) => {
    try {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const sessionToken = process.env.AWS_SESSION_TOKEN;
      if (!accessKeyId || !secretAccessKey) {
        return res.status(400).json({ message: "AWS credentials not configured" });
      }

      const creds = { accessKeyId, secretAccessKey, sessionToken } as const;
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

      const ce = new CostExplorerClient({ region: "us-east-1", credentials: creds });
      const ceResp = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "REGION" }],
      }));

      const totalsByRegion: Record<string, number> = {};
      let total = 0;
      const days = Math.max(1, (ceResp.ResultsByTime ?? []).length);
      for (const day of ceResp.ResultsByTime ?? []) {
        for (const g of day.Groups ?? []) {
          const key = g.Keys?.[0] || "Unknown";
          const amt = parseFloat(g.Metrics?.UnblendedCost?.Amount || "0");
          totalsByRegion[key] = (totalsByRegion[key] || 0) + amt;
          total += amt;
        }
      }
      const regions = Object.entries(totalsByRegion)
        .sort((a, b) => b[1] - a[1])
        .map(([region, amount]) => ({ region, amount }));
      return res.json({ currency: "USD", start, end, days, total, regions });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch AWS MTD regions", error: err instanceof Error ? err.message : String(err) });
    }
  });
}


