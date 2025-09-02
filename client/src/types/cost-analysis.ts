export interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    query_type: string;
    execution_time?: number;
  };
}

export interface AzureMCPRequest {
  method: string;
  params: {
    subscription_id?: string;
    resource_group?: string;
    resource_name?: string;
    time_range?: "monthly" | "yearly" | "custom";
    start_date?: string;
    end_date?: string;
  };
}
