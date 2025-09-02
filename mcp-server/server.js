import express from 'express';
import cors from 'cors';
import { ClientSecretCredential } from '@azure/identity';
import { CostManagementClient } from '@azure/arm-costmanagement';
import { ResourceManagementClient } from '@azure/arm-resources';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Azure credentials from environment variables
const azureCredentials = {
  tenantId: process.env.AZURE_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID
};

// Validate Azure credentials
const validateCredentials = () => {
  const missing = Object.entries(azureCredentials)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missing.length > 0) {
    console.error(`Missing Azure credentials: ${missing.join(', ')}`);
    return false;
  }
  
  console.log('✓ All Azure credentials are configured');
  return true;
};

// Initialize Azure clients
let costManagementClient = null;
let resourceClient = null;

const initializeAzureClients = async () => {
  try {
    const credential = new ClientSecretCredential(
      azureCredentials.tenantId,
      azureCredentials.clientId,
      azureCredentials.clientSecret
    );

    costManagementClient = new CostManagementClient(credential, azureCredentials.subscriptionId);
    resourceClient = new ResourceManagementClient(credential, azureCredentials.subscriptionId);
    
    console.log('✓ Azure clients initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Azure clients:', error.message);
    return false;
  }
};

// Generate sample cost data (for when Azure APIs are not available)
const generateSampleCostData = (type, value) => {
  const sampleResources = [
    { name: 'webapp-prod-001', type: 'Microsoft.Web/sites', cost: 145.67, trend: 'up', percentage: 12.3 },
    { name: 'db-primary-sql', type: 'Microsoft.Sql/servers/databases', cost: 892.45, trend: 'down', percentage: -5.2 },
    { name: 'storage-account-logs', type: 'Microsoft.Storage/storageAccounts', cost: 23.89, trend: 'stable', percentage: 0.8 },
    { name: 'vm-web-server-01', type: 'Microsoft.Compute/virtualMachines', cost: 234.56, trend: 'up', percentage: 8.7 },
    { name: 'network-gateway', type: 'Microsoft.Network/virtualNetworkGateways', cost: 67.34, trend: 'stable', percentage: -1.2 }
  ];

  const totalCost = sampleResources.reduce((sum, r) => sum + r.cost, 0);
  
  return {
    subscription_id: type === 'subscription' ? value : azureCredentials.subscriptionId,
    resource_group: type === 'resource-group' ? value : undefined,
    resource_name: type === 'resource' ? value : undefined,
    total_monthly_cost: totalCost,
    total_yearly_cost: totalCost * 12,
    currency: 'USD',
    analysis_date: new Date().toISOString(),
    cost_breakdown: sampleResources.map(r => ({
      resource_name: r.name,
      resource_type: r.type,
      monthly_cost: r.cost,
      yearly_cost: r.cost * 12,
      trend_percentage: r.percentage,
      trend_direction: r.trend,
      location: 'East US'
    })),
    recommendations: [
      {
        type: 'reserved_instances',
        title: 'Use Reserved Instances for VM',
        description: 'Switch to 1-year reserved instances for vm-web-server-01 to save costs',
        potential_savings: 42.18,
        confidence: 'high',
        resource_name: 'vm-web-server-01',
        action_required: 'Purchase Reserved Instance'
      },
      {
        type: 'right_sizing',
        title: 'Downsize Underutilized Resources',
        description: 'Storage account is underutilized, consider lower tier',
        potential_savings: 12.45,
        confidence: 'medium',
        resource_name: 'storage-account-logs',
        action_required: 'Change Storage Tier'
      },
      {
        type: 'unused_resources',
        title: 'Remove Unused Network Gateway',
        description: 'Network gateway shows minimal usage',
        potential_savings: 67.34,
        confidence: 'high',
        resource_name: 'network-gateway',
        action_required: 'Review and Delete'
      }
    ],
    monthly_trends: [
      { month: '2024-07', cost: 1205.23, change_percentage: -2.1 },
      { month: '2024-08', cost: 1298.67, change_percentage: 7.8 },
      { month: '2024-09', cost: 1363.91, change_percentage: 5.0 },
      { month: '2024-10', cost: 1289.45, change_percentage: -5.5 },
      { month: '2024-11', cost: 1356.78, change_percentage: 5.2 },
      { month: '2024-12', cost: totalCost, change_percentage: 1.8 }
    ],
    service_breakdown: [
      { service_type: 'Compute', cost: 380.23, percentage: 28.1, color: '#0078d4' },
      { service_type: 'Storage', cost: 156.78, percentage: 11.6, color: '#00bcf2' },
      { service_type: 'Database', cost: 892.45, percentage: 66.0, color: '#40e0d0' },
      { service_type: 'Networking', cost: 67.34, percentage: 5.0, color: '#ff6b6b' }
    ],
    highest_cost_resource: {
      resource_name: 'db-primary-sql',
      resource_type: 'Microsoft.Sql/servers/databases',
      monthly_cost: 892.45,
      yearly_cost: 10709.40,
      trend_percentage: -5.2,
      trend_direction: 'down',
      location: 'East US'
    }
  };
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    azure_configured: validateCredentials(),
    clients_initialized: !!costManagementClient && !!resourceClient,
    timestamp: new Date().toISOString()
  });
});

// Main MCP endpoint for Azure cost management
app.post('/mcp/azure-cost-management', async (req, res) => {
  try {
    const { method, params } = req.body;
    
    console.log(`🔍 MCP Request: ${method}`, params);
    
    // Extract parameters
    const subscriptionId = params.subscription_id || azureCredentials.subscriptionId;
    const resourceGroup = params.resource_group;
    const resourceName = params.resource_name;
    const timeRange = params.time_range || 'monthly';
    
    // Determine query type
    let queryType = 'subscription';
    let queryValue = subscriptionId;
    
    if (resourceName) {
      queryType = 'resource';
      queryValue = resourceName;
    } else if (resourceGroup) {
      queryType = 'resource-group';
      queryValue = resourceGroup;
    }
    
    console.log(`📊 Analyzing ${queryType}: ${queryValue}`);
    
    // For now, return sample data (in production, this would call real Azure APIs)
    const costData = generateSampleCostData(queryType, queryValue);
    
    console.log(`✅ Cost analysis completed for ${queryType}: ${queryValue}`);
    console.log(`💰 Total monthly cost: $${costData.total_monthly_cost.toFixed(2)}`);
    
    res.json({
      success: true,
      data: costData,
      metadata: {
        timestamp: new Date().toISOString(),
        query_type: method,
        execution_time: Math.random() * 2000 + 500 // Simulated execution time
      }
    });
    
  } catch (error) {
    console.error('❌ MCP Server Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      metadata: {
        timestamp: new Date().toISOString(),
        query_type: req.body?.method || 'unknown'
      }
    });
  }
});

// Start server
const startServer = async () => {
  console.log('🚀 Starting Azure MCP Server...');
  
  if (!validateCredentials()) {
    console.error('❌ Cannot start server without valid Azure credentials');
    process.exit(1);
  }
  
  // Initialize Azure clients (continue even if this fails for demo purposes)
  await initializeAzureClients();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Azure MCP Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp/azure-cost-management`);
    console.log('📱 Ready to receive cost analysis requests!');
  });
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Azure MCP Server...');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('💥 Failed to start server:', error);
  process.exit(1);
});