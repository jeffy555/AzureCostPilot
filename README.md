# Cloud Cost Management Dashboard

A comprehensive full-stack application for monitoring and managing cloud costs across Azure and MongoDB Atlas with real-time cost tracking, budget utilization monitoring, and accurate currency conversion to Indian Rupees.

## 🌟 Features

### Multi-Cloud Cost Management
- **Azure Integration**: Real-time cost data from Azure Cost Management API
- **MongoDB Atlas Integration**: Live cluster and billing data via MongoDB Atlas API
- **Separate Provider Views**: Dedicated dashboards for each cloud provider
- **Data Isolation**: Complete separation of cost data between providers

### Advanced Cost Analytics
- **Real-Time Cost Tracking**: Live cost data with automatic refresh
- **Currency Conversion**: Automatic USD to INR conversion (₹83.5 rate)
- **Trend Analysis**: Historical cost analysis with interactive charts
- **Service Breakdown**: Detailed cost breakdown by services and resources
- **Budget Monitoring**: Track spending against budgets and forecasts

### User Experience
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Interactive Charts**: Data visualization using Recharts
- **Real-time Updates**: Live data refresh with loading states
- **Search & Filter**: Advanced filtering and search capabilities

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type-safe development
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with shadcn/ui components for modern UI
- **TanStack React Query** for server state management
- **Wouter** for lightweight client-side routing
- **Recharts** for interactive data visualization

### Backend Stack
- **Node.js** with Express.js framework
- **TypeScript** with ESM modules
- **PostgreSQL** with Drizzle ORM for type-safe database operations
- **Neon** serverless database adapter
- **Zod** for runtime validation and type safety

### Cloud Integrations
- **Azure Cost Management API** with service principal authentication
- **MongoDB Atlas Admin API** with digest authentication
- **Automatic IP allowlisting** for secure API access

## 📋 Prerequisites

### Required Software
- **Node.js 18+** and npm
- **PostgreSQL 12+** (optional - will use in-memory storage if not available)
- **Git** for version control

### Cloud Service Requirements
- **Azure Subscription** with Cost Management access
- **Azure Service Principal** with Cost Management Reader role
- **MongoDB Atlas Account** with API access enabled
- **MongoDB Atlas API Keys** with Organization Billing Viewer role

## 🚀 Quick Start

### 1. Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd cloud-cost-dashboard

# Make the setup script executable
chmod +x Todolocal.sh

# Run the setup script
./Todolocal.sh
```

### 2. Configure Environment Variables
Edit the `.env` file with your actual credentials:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/cloudcosts

# Azure Service Principal Configuration
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_SUBSCRIPTION_ID=your_azure_subscription_id

# MongoDB Atlas Configuration
MONGODB_PUBLIC_KEY=your_mongodb_public_key
MONGODB_PRIVATE_KEY=your_mongodb_private_key
MONGODB_ORG_ID=your_mongodb_org_id
MONGODB_PROJECT_ID=your_mongodb_project_id

# Application Configuration
NODE_ENV=development
PORT=9003
```

### 3. Access the Application
- **Main Dashboard**: http://localhost:9003
- **Azure View**: http://localhost:9003/azure
- **MongoDB View**: http://localhost:9003/mongodb
- **API Endpoints**: http://localhost:9003/api

## 🔧 Manual Installation

If you prefer manual setup:

```bash
# Install dependencies
npm install

# Create and configure .env file
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

## 🔑 Authentication Setup

### Azure Service Principal Setup

1. **Create Service Principal**:
   ```bash
   az ad sp create-for-rbac --name "cost-management-sp" \
     --role "Cost Management Reader" \
     --scopes "/subscriptions/{subscription-id}"
   ```

2. **Required Permissions**:
   - Cost Management Reader
   - Billing Reader (optional for enhanced data)

3. **Configure in .env**:
   ```env
   AZURE_CLIENT_ID=<appId from step 1>
   AZURE_CLIENT_SECRET=<password from step 1>
   AZURE_TENANT_ID=<tenant from step 1>
   AZURE_SUBSCRIPTION_ID=<your subscription id>
   ```

### MongoDB Atlas API Setup

1. **Create API Key**:
   - Go to MongoDB Atlas → Organizations → Access Manager
   - Create API Key with "Organization Billing Viewer" role

2. **Configure IP Allowlist**:
   - Add your application's IP address to the allowlist
   - For local development, add your current public IP

3. **Configure in .env**:
   ```env
   MONGODB_PUBLIC_KEY=<public key>
   MONGODB_PRIVATE_KEY=<private key>
   MONGODB_ORG_ID=<organization id>
   MONGODB_PROJECT_ID=<project id>
   ```

## 📊 API Endpoints

### Cost Data
- `GET /api/cost-data` - Retrieve all cost data
- `POST /api/refresh-cost-data` - Refresh cost data from APIs
- `GET /api/cost-summary` - Get cost summary and analytics

### Service Principals
- `GET /api/service-principals` - List configured service principals
- `POST /api/service-principals` - Add new service principal
- `PUT /api/service-principals/:id` - Update service principal
- `DELETE /api/service-principals/:id` - Remove service principal

### Health Check
- `GET /api/health` - Application health status

## 🎨 UI Components

### Dashboard Views
- **Azure View**: Dedicated Azure cost management interface
- **MongoDB View**: MongoDB Atlas cost and cluster monitoring
- **Unified Dashboard**: Cross-provider cost overview

### Key Features
- Real-time cost metrics cards
- Interactive cost trend charts
- Searchable resource tables
- Service breakdown pie charts
- Budget utilization tracking

## 🗄️ Database Schema

### Core Tables
- **users**: User authentication and profiles
- **service_principals**: Cloud provider credentials
- **cost_data**: Granular cost information by resource
- **cost_summary**: Aggregated cost metrics and trends

### Data Flow
1. **Authentication**: Service principal credentials stored securely
2. **Data Fetching**: Real-time API calls to cloud providers
3. **Processing**: Currency conversion and data normalization
4. **Storage**: Structured data storage with relationships
5. **Analytics**: Real-time aggregation and trend calculation

## 🔧 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Project Structure
```
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities and helpers
├── server/              # Backend Express application
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Data storage layer
│   └── index.ts         # Server entry point
├── shared/              # Shared types and schemas
│   └── schema.ts        # Zod schemas and types
└── package.json         # Dependencies and scripts
```

## 🐛 Troubleshooting

### Common Issues

**Azure API Authentication Errors**:
- Verify service principal credentials
- Check subscription ID is correct
- Ensure Cost Management Reader role is assigned

**MongoDB Atlas Connection Failures**:
- Verify API keys are valid and not expired
- Check IP address is in MongoDB Atlas allowlist
- Ensure Organization Billing Viewer role is assigned

**Database Connection Issues**:
- Verify PostgreSQL is running
- Check DATABASE_URL format is correct
- Application will fall back to in-memory storage if DB unavailable

**Port Already in Use**:
```bash
# Find and kill process using port 9003
lsof -ti:9003 | xargs kill -9

# Or use a different port
PORT=3000 npm run dev
```

### Getting Help

1. **Check Logs**: Application logs show detailed error information
2. **Verify Credentials**: Ensure all API credentials are valid
3. **Network Access**: Confirm IP allowlists are properly configured
4. **Dependencies**: Ensure all npm packages are installed correctly

## 📈 Performance

### Optimization Features
- **Efficient Data Fetching**: Optimized API calls with caching
- **Type Safety**: End-to-end TypeScript for reliability
- **Responsive Design**: Optimized for all screen sizes
- **Real-time Updates**: Smart refresh strategies to minimize API calls

### Scalability
- **Database Indexing**: Optimized queries for large datasets
- **API Rate Limiting**: Respectful API usage patterns
- **Memory Management**: Efficient data structures and cleanup

## 🔒 Security

### Security Features
- **Credential Encryption**: Secure storage of API credentials
- **IP Allowlisting**: Network-level security for API access
- **Input Validation**: Comprehensive validation using Zod schemas
- **Environment Variables**: Sensitive data stored in environment variables

### Best Practices
- Regular credential rotation
- Least privilege access roles
- Secure communication over HTTPS
- Regular security updates

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Check the troubleshooting section above
- Review the API documentation
- Verify your cloud provider credentials and permissions

---

Built with ❤️ for efficient cloud cost management across Azure and MongoDB Atlas.