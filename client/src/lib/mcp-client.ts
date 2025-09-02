import { MCPResponse } from "@/types/cost-analysis";
import { CostAnalysisResponse } from "@shared/schema";

// Azure MCP Client for Direct Communication
// Architecture: React Frontend → Azure MCP Server → Azure Cloud
class AzureMCPClient {
  private mcpUrl: string;

  constructor() {
    this.mcpUrl = import.meta.env.VITE_MCP_URL || 'http://localhost:3000';
    console.log('Azure MCP Client initialized - direct connection to MCP server');
  }

  // Health check for Azure MCP server
  async checkHealth(): Promise<{ status: string; azure_configured: boolean; timestamp: string }> {
    try {
      const response = await fetch(`${this.mcpUrl}/health`);
      if (!response.ok) {
        throw new Error(`MCP Health check failed: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('MCP Health check error:', error);
      return { status: 'error', azure_configured: false, timestamp: new Date().toISOString() };
    }
  }

  // Direct MCP call for Azure cost analysis
  async getCostAnalysis(subscriptionId: string, resourceGroup?: string): Promise<MCPResponse<CostAnalysisResponse>> {
    try {
      console.log(`🔍 Sending MCP request for subscription: ${subscriptionId}`);
      
      const response = await fetch(`${this.mcpUrl}/mcp/azure-cost-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          method: 'get_cost_analysis',
          params: {
            subscription_id: subscriptionId,
            time_range: 'monthly',
            ...(resourceGroup ? { resource_group: resourceGroup } : {})
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MCP cost analysis failed: ${response.status} - ${error}`);
      }
      
      const result = await response.json();
      console.log(`✅ MCP response received:`, result.success ? 'Success' : 'Failed');
      
      return result;
    } catch (error) {
      console.error('Azure MCP Client Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          timestamp: new Date().toISOString(),
          query_type: 'mcp_cost_analysis',
        }
      };
    }
  }

  // Process chat message and determine if it's a cost analysis request
  async processChatMessage(message: string, subscriptionId: string): Promise<MCPResponse<CostAnalysisResponse>> {
    const costKeywords = ['cost', 'analyze', 'breakdown', 'spend', 'budget', 'price', 'money', 'bill', 'expense', 'usage'];
    const isCostQuery = costKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    if (isCostQuery && subscriptionId) {
      console.log(`🤖 Detected cost analysis request in message: "${message}"`);
      return await this.getCostAnalysis(subscriptionId);
    }
    
    return {
      success: false,
      error: 'Please enter a subscription name and ask about costs, analysis, or spending.',
      metadata: {
        timestamp: new Date().toISOString(),
        query_type: 'chat_processing'
      }
    };
  }

  // Legacy methods for compatibility (redirected to MCP)
  async getDetailedCostBreakdown(
    type: "subscription" | "resource-group" | "resource",
    value: string
  ): Promise<MCPResponse<CostAnalysisResponse>> {
    return this.getCostAnalysis(value);
  }

  async getCostOptimizationRecommendations(
    type: "subscription" | "resource-group" | "resource",
    value: string
  ): Promise<MCPResponse<CostAnalysisResponse>> {
    return this.getCostAnalysis(value);
  }
}

export const azureMCPClient = new AzureMCPClient();

// Export legacy name for compatibility
export const mcpClient = azureMCPClient;
