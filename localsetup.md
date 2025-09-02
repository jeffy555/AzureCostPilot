# Azure Cost Management Assistant - Local Setup Guide

This guide will help you run the Azure Cost Management application on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18.0 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)
- **Azure Account** with appropriate permissions

## Architecture Overview

The application follows this flow:
**React Frontend → Azure MCP Server → Azure Cloud → Response**

- **Frontend**: React app with Vite (runs on port 5000)
- **Azure MCP Server**: Standalone server that connects to Azure APIs (runs on port 3000)
- **Backend**: Express server for static file serving (runs on port 5000)

## Step 1: Download and Setup Project

1. Download all project files to your local machine
2. Navigate to the project directory:
   ```bash
   cd azure-cost-management-assistant
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Step 2: Azure Credentials Setup

### 2.1 Create Azure Service Principal

You need an Azure Service Principal with the following permissions:
- **Cost Management Reader** role
- **Reader** role (for resource details)

### 2.2 Get Required Credentials

From your Azure Service Principal, collect:
- **Tenant ID**
- **Client ID** (Application ID)
- **Client Secret**
- **Subscription ID** (the subscription you want to analyze)

### 2.3 Configure Environment Variables

Create a `.env` file in the root directory with your Azure credentials:

```bash
# .env
AZURE_TENANT_ID=your-tenant-id-here
AZURE_CLIENT_ID=your-client-id-here
AZURE_CLIENT_SECRET=your-client-secret-here
AZURE_SUBSCRIPTION_ID=your-subscription-id-here

# Optional: Custom MCP server URL (defaults to http://localhost:3000)
VITE_MCP_URL=http://localhost:3000
```

**⚠️ Important**: Never commit the `.env` file to version control. Add it to `.gitignore`.

## Step 3: Running the Application

### Option 1: Run Everything Together (Recommended)

Start both servers with a single command:
```bash
npm run dev
```

This will start:
- Frontend (React + Vite) on port 5000
- Backend (Express) on port 5000
- You'll need to manually start the MCP server (see Option 2)

### Option 2: Run Servers Separately

#### Terminal 1: Start Azure MCP Server
```bash
node azure-mcp-server.cjs
```
You should see:
```
🔐 Azure MCP Server - Credentials Status:
   Tenant ID: ✅ Set
   Client ID: ✅ Set
   Client Secret: ✅ Set
   Subscription ID: ✅ Set
🚀 Azure MCP Server running on port 3000
```

#### Terminal 2: Start Frontend/Backend
```bash
npm run dev
```

## Step 4: Verify Setup

1. **Check MCP Server Health**:
   ```bash
   curl http://localhost:3000/health
   ```
   Should return:
   ```json
   {
     "status": "running",
     "azure_configured": true,
     "mcp_server": "azure_cost_management",
     "timestamp": "2025-09-01T19:14:36.032Z"
   }
   ```

2. **Test Azure Connection**:
   ```bash
   curl -X POST http://localhost:3000/mcp/azure-cost-analysis \
     -H "Content-Type: application/json" \
     -d '{"method":"get_cost_analysis","params":{"subscription_id":"your-subscription-id","time_range":"monthly"}}'
   ```

3. **Access Application**:
   Open your browser and go to: http://localhost:5000

## Step 5: Using the Application

1. **Enter Subscription**: Use the sidebar to enter your Azure subscription ID
2. **Ask Questions**: Use the chat interface to ask about costs:
   - "Show me the total costs"
   - "What are my highest cost resources?"
   - "Give me optimization recommendations"
   - "Analyze costs for this subscription"

## Troubleshooting

### Common Issues

#### 1. "Azure credentials missing" error
- Verify your `.env` file exists and contains all required variables
- Restart both servers after creating/updating `.env`

#### 2. "MCP Health check error"
- Ensure the Azure MCP server is running on port 3000
- Check if port 3000 is available: `lsof -i :3000`

#### 3. "Azure API authentication failed"
- Verify your Azure Service Principal credentials
- Ensure the Service Principal has the required roles:
  - Cost Management Reader
  - Reader (for the subscription)

#### 4. "Invalid subscription ID" error
- Ensure you're using a valid Azure subscription ID format
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Verify the subscription exists and you have access

### Port Conflicts

If you encounter port conflicts:

1. **Change MCP Server Port**:
   Edit `azure-mcp-server.cjs` and change `PORT = 3000` to another port
   Update `VITE_MCP_URL` in `.env` accordingly

2. **Change Frontend Port**:
   The frontend port can be configured in `vite.config.ts`

### Debugging

#### Enable Detailed Logs
Add this to your `.env` file:
```bash
DEBUG=azure:*
NODE_ENV=development
```

#### Check Server Logs
- MCP Server logs: Console output from `node azure-mcp-server.cjs`
- Frontend logs: Browser developer console
- Backend logs: Console output from `npm run dev`

## File Structure

```
azure-cost-management-assistant/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── lib/              # MCP client library
│   │   └── pages/            # Application pages
├── server/                    # Express backend
├── shared/                    # Shared TypeScript schemas
├── azure-mcp-server.cjs      # Azure MCP server
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (create this)
└── localsetup.md            # This setup guide
```

## Additional Configuration

### Custom Azure Endpoints
If you need to use different Azure endpoints, modify the URLs in `azure-mcp-server.cjs`:
- Authentication: `https://login.microsoftonline.com/`
- Cost Management: `https://management.azure.com/`

### Development vs Production
- **Development**: Uses `NODE_ENV=development` with detailed logging
- **Production**: Set `NODE_ENV=production` for optimized builds

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- Azure credentials are processed server-side only
- The MCP server acts as a secure proxy to Azure APIs
- All authentication is handled via Azure Service Principal

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify Azure credentials and permissions
3. Ensure all servers are running correctly
4. Check browser developer console for frontend errors

---

**Architecture**: React Frontend → Azure MCP Server → Azure Cloud APIs → Structured Cost Reports