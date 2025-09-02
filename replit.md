# Azure Cost Analysis Dashboard

## Overview

This is a full-stack React application that provides Azure cost analysis capabilities through a web interface. The application allows users to query Azure cost data by subscription, resource group, or specific resources, and presents the information through interactive dashboards, chat interfaces, and structured data outputs. It uses a modern tech stack with React frontend, Express backend, and integrates with Azure cost management APIs through MCP (Model Context Protocol) clients.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for build tooling
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation resolvers

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Storage**: PostgreSQL-based session storage with connect-pg-simple
- **Development**: Hot reload with Vite middleware integration

### Data Storage Solutions
- **Primary Database**: PostgreSQL (configured for use with Neon Database serverless)
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle Kit for database schema migrations
- **Session Storage**: PostgreSQL tables for user session persistence

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL backend storage
- **Storage Interface**: Abstracted storage layer with in-memory fallback for development
- **User Management**: Basic user CRUD operations with UUID-based identification

### External Service Integrations

#### Azure Cost Management Integration
- **Protocol**: MCP (Model Context Protocol) client for Azure cost analysis
- **Authentication**: Azure Service Principal with Tenant ID, Client ID, Client Secret
- **Architecture**: Secure backend API proxy to Azure MCP server
- **API Structure**: RESTful endpoints for cost queries by subscription, resource group, or resource
- **Data Types**: Structured cost analysis responses with resource breakdowns, trends, and optimization recommendations
- **Error Handling**: Comprehensive error handling with fallback mechanisms
- **Security**: Azure credentials managed via Replit Secrets and processed securely on backend

#### Key Integration Features
- Real-time cost analysis queries
- Historical cost trend analysis
- Resource-level cost breakdowns
- Optimization recommendations with confidence levels
- Service cost categorization and visualization
- Chat interface for natural language cost queries

### Component Architecture
The frontend follows a modular component structure with:
- **UI Components**: Reusable components from shadcn/ui
- **Feature Components**: Specialized components for cost analysis (charts, tables, chat interface)
- **Page Components**: Route-level components for different application views
- **Custom Hooks**: Utility hooks for mobile detection, toast notifications, and form management

### Development and Build Process
- **Development**: Vite dev server with hot module replacement
- **Build**: Vite for frontend bundling, esbuild for backend compilation
- **Type Checking**: Comprehensive TypeScript configuration with strict mode
- **Linting**: Path aliases configured for clean imports (@/, @shared/, @assets/)

The application architecture emphasizes type safety, developer experience, and maintainable code organization while providing a responsive and accessible user interface for Azure cost management tasks.

## Recent Changes

**January 2025**
- Updated architecture to use secure backend API for Azure MCP communication
- Added Azure Service Principal authentication with Tenant ID, Client ID, Client Secret, and Subscription ID
- Implemented backend Azure MCP client with proper credential handling
- Added Azure health check endpoint at /api/azure/health
- Enhanced frontend to show Azure connection status in real-time
- Removed direct frontend-to-MCP communication for improved security