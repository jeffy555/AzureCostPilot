import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const cloudProviders = pgTable("cloud_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // 'azure', 'mongodb', 'aws', 'gcp'
  // Azure specific fields
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  tenantId: text("tenant_id"),
  subscriptionId: text("subscription_id"),
  // MongoDB Atlas specific fields
  publicKey: text("public_key"),
  privateKey: text("private_key"), 
  orgId: text("org_id"),
  projectId: text("project_id"),
  // Common fields
  status: text("status").notNull().default("active"), // active, error, disabled
  lastSync: timestamp("last_sync"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Alias for backward compatibility
export const servicePrincipals = cloudProviders;

export const costData = pgTable("cost_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => cloudProviders.id),
  provider: text("provider").notNull(), // 'azure', 'mongodb', 'aws', 'gcp'
  date: timestamp("date").notNull(),
  // Azure specific fields
  resourceGroup: text("resource_group"),
  serviceName: text("service_name"),
  location: text("location"),
  // MongoDB specific fields  
  clusterName: text("cluster_name"),
  databaseName: text("database_name"),
  serviceType: text("service_type"), // 'cluster', 'backup', 'dataTransfer', etc.
  region: text("region"),
  // Common cost fields
  dailyCost: decimal("daily_cost", { precision: 10, scale: 2 }),
  monthlyCost: decimal("monthly_cost", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const costSummary = pgTable("cost_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  totalMonthlyCost: decimal("total_monthly_cost", { precision: 10, scale: 2 }),
  todaySpend: decimal("today_spend", { precision: 10, scale: 2 }),
  activeResources: text("active_resources"),
  budgetUtilization: decimal("budget_utilization", { precision: 5, scale: 2 }),
  trendData: jsonb("trend_data"),
  serviceBreakdown: jsonb("service_breakdown"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCloudProviderSchema = createInsertSchema(cloudProviders).omit({
  id: true,
  createdAt: true,
  lastSync: true,
});

// Keep the old schema for backward compatibility
export const insertServicePrincipalSchema = insertCloudProviderSchema;

export const insertCostDataSchema = createInsertSchema(costData).omit({
  id: true,
  createdAt: true,
});

export const insertCostSummarySchema = createInsertSchema(costSummary).omit({
  id: true,
  lastUpdated: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCloudProvider = z.infer<typeof insertCloudProviderSchema>;
export type CloudProvider = typeof cloudProviders.$inferSelect;

// Keep the old types for backward compatibility
export type InsertServicePrincipal = InsertCloudProvider;
export type ServicePrincipal = CloudProvider;

export type InsertCostData = z.infer<typeof insertCostDataSchema>;
export type CostData = typeof costData.$inferSelect;

export type InsertCostSummary = z.infer<typeof insertCostSummarySchema>;
export type CostSummary = typeof costSummary.$inferSelect;
