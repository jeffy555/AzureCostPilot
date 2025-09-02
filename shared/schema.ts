import { z } from "zod";

// Azure Cost Analysis schemas
export const subscriptionQuerySchema = z.object({
  type: z.enum(["subscription", "resource-group", "resource"]),
  value: z.string().min(1, "Input value is required")
});

export const resourceCostSchema = z.object({
  resource_name: z.string(),
  resource_type: z.string(),
  monthly_cost: z.number(),
  yearly_cost: z.number().optional(),
  trend_percentage: z.number(),
  trend_direction: z.enum(["up", "down", "stable"]),
  resource_id: z.string().optional(),
  location: z.string().optional(),
  resource_group: z.string().optional()
});

export const costRecommendationSchema = z.object({
  type: z.enum(["reserved_instances", "right_sizing", "unused_resources", "spot_instances", "savings_plan"]),
  title: z.string(),
  description: z.string(),
  potential_savings: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  resource_name: z.string().optional(),
  action_required: z.string().optional()
});

export const monthlyCostTrendSchema = z.object({
  month: z.string(),
  cost: z.number(),
  change_percentage: z.number().optional()
});

export const serviceCostBreakdownSchema = z.object({
  service_type: z.string(),
  cost: z.number(),
  percentage: z.number(),
  color: z.string().optional()
});

export const costAnalysisResponseSchema = z.object({
  subscription_id: z.string().optional(),
  resource_group: z.string().optional(),
  resource_name: z.string().optional(),
  total_monthly_cost: z.number(),
  total_yearly_cost: z.number(),
  currency: z.string().default("USD"),
  analysis_date: z.string(),
  cost_breakdown: z.array(resourceCostSchema),
  recommendations: z.array(costRecommendationSchema),
  monthly_trends: z.array(monthlyCostTrendSchema),
  service_breakdown: z.array(serviceCostBreakdownSchema),
  highest_cost_resource: resourceCostSchema.optional()
});

export const chatMessageSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.date(),
  isLoading: z.boolean().optional()
});

// Type exports
export type SubscriptionQuery = z.infer<typeof subscriptionQuerySchema>;
export type ResourceCost = z.infer<typeof resourceCostSchema>;
export type CostRecommendation = z.infer<typeof costRecommendationSchema>;
export type MonthlyCostTrend = z.infer<typeof monthlyCostTrendSchema>;
export type ServiceCostBreakdown = z.infer<typeof serviceCostBreakdownSchema>;
export type CostAnalysisResponse = z.infer<typeof costAnalysisResponseSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
