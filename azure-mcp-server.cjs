#!/usr/bin/env node

/**
 * Azure MCP Server - Direct connection to Azure Cloud
 * Architecture: React Frontend → Azure MCP Server → Azure Cloud
 */

// Load environment variables from .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Enable CORS for frontend communication
app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:5050', 'http://localhost:5173', 'http://localhost:9000'],
  credentials: true
}));

app.use(express.json());

// Azure credentials from environment variables
const azureCredentials = {
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID
};

console.log('🔐 Azure MCP Server - Credentials Status:');
console.log(`   Tenant ID: ${azureCredentials.tenantId ? '✅ Set' : '❌ Missing'}`);
console.log(`   Client ID: ${azureCredentials.clientId ? '✅ Set' : '❌ Missing'}`);
console.log(`   Client Secret: ${azureCredentials.clientSecret ? '✅ Set' : '❌ Missing'}`);
console.log(`   Subscription ID: ${azureCredentials.subscriptionId ? '✅ Set' : '❌ Missing'}`);

// Azure API client for real cost management
class AzureCloudClient {
  constructor() {
    this.credentials = azureCredentials;
  }

  // Detect if a string is a GUID/UUID
  isGuid(value) {
    if (!value || typeof value !== 'string') return false;
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return guidRegex.test(value.trim());
  }

  // Get Azure access token
  async getAccessToken() {
    const tokenUrl = `https://login.microsoftonline.com/${this.credentials.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      'client_id': this.credentials.clientId,
      'client_secret': this.credentials.clientSecret,
      'scope': 'https://management.azure.com/.default',
      'grant_type': 'client_credentials'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure authentication failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  // Resolve a subscription name (displayName) to its subscriptionId (GUID)
  async resolveSubscriptionIdByName(subscriptionName) {
    const accessToken = await this.getAccessToken();

    const url = `https://management.azure.com/subscriptions?api-version=2020-01-01`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list subscriptions: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const list = Array.isArray(data.value) ? data.value : [];
    const match = list.find((s) =>
      typeof s?.displayName === 'string' && s.displayName.toLowerCase() === String(subscriptionName).toLowerCase()
    );

    if (!match?.subscriptionId) {
      const available = list.map((s) => s.displayName).filter(Boolean).slice(0, 10);
      throw new Error(`Subscription name not found: "${subscriptionName}". Available: ${available.join(', ')}`);
    }

    return match.subscriptionId;
  }

  // Get real Azure cost data
  async getCostAnalysis(subscriptionId, options = {}) {
    const { resourceGroup } = options;
    const accessToken = await this.getAccessToken();
    
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    
    const costAnalysisUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`;
    
    const requestBody = {
      type: 'ActualCost',
      timeframe: 'Custom',
      timePeriod: {
        from: lastMonth.toISOString().split('T')[0],
        to: endOfLastMonth.toISOString().split('T')[0]
      },
      dataset: {
        granularity: 'Daily',
        aggregation: {
          totalCost: {
            name: 'PreTaxCost',
            function: 'Sum'
          }
        },
        grouping: [
          { type: 'Dimension', name: 'ResourceId' },
          { type: 'Dimension', name: 'ResourceType' },
          { type: 'Dimension', name: 'ResourceGroupName' },
          { type: 'Dimension', name: 'ResourceLocation' }
        ]
      }
    };

    // Apply resource group filter if provided
    if (resourceGroup && typeof resourceGroup === 'string') {
      requestBody.dataset.filter = {
        dimensions: {
          name: 'ResourceGroupName',
          operator: 'In',
          values: [resourceGroup]
        }
      };
    }

    const response = await fetch(costAnalysisUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure Cost Management API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  // Get Azure resources
  async getResources(subscriptionId) {
    const accessToken = await this.getAccessToken();
    
    const resourcesUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`;
    
    const response = await fetch(resourcesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure Resources API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  // Process Azure data into structured report
  processAzureData(costData, _resourceData, subscriptionId) {
    const rows = costData.properties?.rows || [];
    const columns = costData.properties?.columns || [];

    // Find column indices
    const costIndex = columns.findIndex(col => col.name === 'PreTaxCost');
    const resourceTypeIndex = columns.findIndex(col => col.name === 'ResourceType');
    const resourceGroupIndex = columns.findIndex(col => col.name === 'ResourceGroupName');
    const resourceIdIndex = columns.findIndex(col => col.name === 'ResourceId');
    const resourceLocationIndex = columns.findIndex(col => col.name === 'ResourceLocation');

    // Aggregate costs by resource id
    const costByResourceId = new Map();
    const costByResourceType = new Map();
    let totalCost = 0;

    for (const row of rows) {
      const cost = parseFloat(row[costIndex]) || 0;
      const resourceId = row[resourceIdIndex] || 'unknown';
      const resourceType = row[resourceTypeIndex] || 'Unknown';
      const resourceGroup = row[resourceGroupIndex] || 'Unknown';
      const resourceLocation = row[resourceLocationIndex] || 'Unknown';

      totalCost += cost;

      const current = costByResourceId.get(resourceId) || { cost: 0, resourceType, resourceGroup, resourceLocation };
      current.cost += cost;
      current.resourceType = resourceType;
      current.resourceGroup = resourceGroup;
      current.resourceLocation = resourceLocation;
      costByResourceId.set(resourceId, current);

      costByResourceType.set(resourceType, (costByResourceType.get(resourceType) || 0) + cost);
    }

    // Build resource-level breakdown
    const costBreakdown = Array.from(costByResourceId.entries()).map(([rid, info]) => {
      const resourceName = typeof rid === 'string' ? rid.split('/').filter(Boolean).pop() || rid : 'unknown';
      return {
        resource_name: resourceName,
        resource_type: info.resourceType,
        monthly_cost: info.cost,
        yearly_cost: info.cost * 12,
        location: info.resourceLocation,
        resource_group: info.resourceGroup
      };
    }).sort((a, b) => b.monthly_cost - a.monthly_cost);

    // Service/type breakdown
    const serviceBreakdown = Array.from(costByResourceType.entries()).map(([type, cost]) => ({
      service_type: String(type).split('/')[0] || 'Other',
      cost,
      percentage: totalCost ? (cost / totalCost) * 100 : 0,
      color: this.getServiceColor(String(type))
    })).sort((a, b) => b.cost - a.cost).slice(0, 5);

    const highestCostResource = costBreakdown[0] || null;

    return {
      subscription_id: subscriptionId,
      total_monthly_cost: totalCost,
      total_yearly_cost: totalCost * 12,
      currency: 'USD',
      analysis_date: new Date().toISOString(),
      cost_breakdown: costBreakdown.slice(0, 50),
      recommendations: [],
      service_breakdown: serviceBreakdown,
      highest_cost_resource: highestCostResource,
      resource_count: costBreakdown.length,
      data_source: 'azure_cloud_api'
    };
  }

  getServiceColor(resourceType) {
    const colorMap = {
      'Microsoft.Compute': '#0078d4',
      'Microsoft.Storage': '#00bcf2', 
      'Microsoft.Sql': '#40e0d0',
      'Microsoft.Network': '#ff6b6b',
      'Microsoft.Web': '#32cd32',
      'Microsoft.KeyVault': '#ffa500'
    };
    
    const service = resourceType.split('/')[0];
    return colorMap[service] || '#808080';
  }
}

const azureClient = new AzureCloudClient();

// MCP Health endpoint
app.get('/health', (req, res) => {
  const hasCredentials = Object.values(azureCredentials).every(cred => !!cred);
  
  res.json({
    status: 'running',
    azure_configured: hasCredentials,
    mcp_server: 'azure_cost_management',
    timestamp: new Date().toISOString()
  });
});

// Main MCP endpoint for Azure cost analysis
app.post('/mcp/azure-cost-analysis', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { method, params } = req.body;
    
    console.log(`🔍 MCP Request: ${method} with params:`, params);
    
    if (method !== 'get_cost_analysis') {
      return res.status(400).json({
        success: false,
        error: `Unknown method: ${method}`,
        supported_methods: ['get_cost_analysis']
      });
    }
    
    // Validate credentials
    if (!azureCredentials.tenantId || !azureCredentials.clientId || !azureCredentials.clientSecret) {
      return res.status(500).json({
        success: false,
        error: 'Missing Azure credentials. Please configure AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.',
        metadata: {
          timestamp: new Date().toISOString(),
          execution_time: Date.now() - startTime
        }
      });
    }
    
    // Get subscription input from params or environment
    const subscriptionInput = params.subscription_id || azureCredentials.subscriptionId;
    const resourceGroup = params.resource_group;

    if (!subscriptionInput) {
      return res.status(400).json({
        success: false,
        error: 'No subscription provided in request or environment',
        metadata: {
          timestamp: new Date().toISOString(),
          execution_time: Date.now() - startTime
        }
      });
    }

    // Require GUID format for subscription
    if (!azureClient.isGuid(subscriptionInput)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription ID format. Please provide a GUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
        metadata: {
          timestamp: new Date().toISOString(),
          execution_time: Date.now() - startTime
        }
      });
    }

    const subscriptionId = subscriptionInput;
    console.log(`🔐 Authenticating with Azure for subscription: ${subscriptionId}`);
    
    // Fetch real Azure data
    const [costData, resourceData] = await Promise.all([
      azureClient.getCostAnalysis(subscriptionId, { resourceGroup }),
      azureClient.getResources(subscriptionId)
    ]);
    
    // Process data into structured report
    const report = azureClient.processAzureData(costData, resourceData, subscriptionId);
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ Azure cost analysis completed - Total: $${report.total_monthly_cost.toFixed(2)} (${executionTime}ms)`);
    
    res.json({
      success: true,
      data: report,
      metadata: {
        timestamp: new Date().toISOString(),
        execution_time: executionTime,
        data_source: 'azure_cloud_mcp',
        subscription_id: subscriptionId
      }
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Azure MCP Server Error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      metadata: {
        timestamp: new Date().toISOString(),
        execution_time: executionTime,
        data_source: 'azure_cloud_mcp'
      }
    });
  }
});

// Start the Azure MCP Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Azure MCP Server running on port', PORT);
  console.log('🔗 Health: http://localhost:3000/health');
  console.log('🔗 MCP Endpoint: http://localhost:3000/mcp/azure-cost-analysis');
  console.log('🏗️  Architecture: React Frontend → Azure MCP Server → Azure Cloud');
});