import * as dotenv from "dotenv";
dotenv.config();
import type { Express } from "express";
import { BigQuery } from "@google-cloud/bigquery";
import fs from "fs";

function getBigQueryClient() {
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_JSON;

  // Try to derive projectId from service account when available
  const deriveProjectId = (): string | undefined => {
    try {
      if (keyFilePath && fs.existsSync(keyFilePath)) {
        const raw = fs.readFileSync(keyFilePath, "utf8");
        const parsed = JSON.parse(raw);
        return parsed.project_id as string | undefined;
      }
      if (keyJson) {
        const parsed = JSON.parse(keyJson);
        return parsed.project_id as string | undefined;
      }
    } catch {
      // ignore
    }
    return undefined;
  };

  const projectId = deriveProjectId();
  if (projectId && (!process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT !== projectId)) {
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.GCLOUD_PROJECT = projectId;
    // eslint-disable-next-line no-console
    console.log("[GCP] Using projectId:", projectId);
  }

  // Prefer explicit key file path if provided and exists
  if (keyFilePath && fs.existsSync(keyFilePath)) {
    return new BigQuery(projectId ? { projectId, keyFilename: keyFilePath } : { keyFilename: keyFilePath });
  }

  // Fallback to inline JSON if provided
  if (keyJson) {
    const credentials = JSON.parse(keyJson);
    return new BigQuery(projectId ? { projectId, credentials } : { credentials });
  }

  // Final fallback to ADC/environment
  return projectId ? new BigQuery({ projectId }) : new BigQuery();
}

export async function registerGcpRoutes(app: Express) {
  // MTD total and avg daily
  app.get("/api/gcp/mtd-summary", async (_req, res) => {
    try {
      const project = process.env.GCP_BQ_PROJECT_ID;
      const dataset = process.env.GCP_BQ_DATASET;
      const table = process.env.GCP_BQ_TABLE; // may be just table name OR fully-qualified tableId
      if (!table) return res.status(400).json({ message: "GCP table not configured" });

      const bq = getBigQueryClient();
      const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0,10);
      const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0,10);
      const tableRef = table.includes(".") ? table : `${project}.${dataset}.${table}`;
      // Debug: log resolved table reference
      // eslint-disable-next-line no-console
      console.log("[GCP] mtd-summary env:", { project, dataset, table, tableRef });

      const query = `
        SELECT
          SUM(cost) AS total
        FROM \`${tableRef}\`
        WHERE usage_start_time >= TIMESTAMP(@start)
          AND usage_start_time < TIMESTAMP(@end)
      `;
      const [rows] = await bq.query({
        query,
        params: { start: `${start} 00:00:00+00`, end: `${end} 00:00:00+00` },
      });
      const total = Number(rows?.[0]?.total || 0);
      const days = Math.max(1, Math.floor((Date.parse(end) - Date.parse(start)) / 86400000));
      return res.json({ currency: "USD", start, end, total, avgDaily: total / days });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch GCP MTD summary", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // MTD by service
  app.get("/api/gcp/mtd-services", async (_req, res) => {
    try {
      const project = process.env.GCP_BQ_PROJECT_ID;
      const dataset = process.env.GCP_BQ_DATASET;
      const table = process.env.GCP_BQ_TABLE; // may be fully-qualified
      if (!table) return res.status(400).json({ message: "GCP table not configured" });
      const bq = getBigQueryClient();
      const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0,10);
      const end = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString().slice(0,10);
      const tableRef = table.includes(".") ? table : `${project}.${dataset}.${table}`;
      // Debug: log resolved table reference
      // eslint-disable-next-line no-console
      console.log("[GCP] mtd-services env:", { project, dataset, table, tableRef });

      const query = `
        SELECT service.description AS service, SUM(cost) AS amount
        FROM \`${tableRef}\`
        WHERE usage_start_time >= TIMESTAMP(@start)
          AND usage_start_time < TIMESTAMP(@end)
        GROUP BY service
        ORDER BY amount DESC
      `;
      const [rows] = await bq.query({ query, params: { start: `${start} 00:00:00+00`, end: `${end} 00:00:00+00` } });
      const services = rows.map((r: any) => ({ service: r.service || "Unknown", amount: Number(r.amount || 0) }));
      const total = services.reduce((s: number, r: any) => s + r.amount, 0);
      return res.json({ currency: "USD", start, end, total, services });
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch GCP MTD services", error: err instanceof Error ? err.message : String(err) });
    }
  });
}


