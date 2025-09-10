# Overview

This is a full-stack cloud cost management dashboard application built with React, Express, and TypeScript. The application provides a comprehensive interface for monitoring and managing Azure cloud costs through Service Principal connections. It features real-time cost tracking, budget utilization monitoring, resource breakdown analysis, and multi-cloud provider integration capabilities (with Azure currently implemented and AWS/GCP planned).

The system allows users to connect multiple Azure Service Principals, automatically sync cost data, and visualize spending patterns through interactive charts and tables. It includes service principal management, cost summaries, trend analysis, and resource-level cost breakdowns.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development/bundling
- **UI Framework**: Tailwind CSS with shadcn/ui component library using Radix UI primitives
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Charts**: Recharts for data visualization (cost trends, service breakdowns)

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful API with structured error handling and request logging
- **Storage Abstraction**: Interface-based storage pattern with in-memory implementation for development
- **Validation**: Zod schemas for runtime type validation shared between client and server

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless database adapter for cloud-native database access
- **Schema Management**: Drizzle Kit for database migrations and schema evolution
- **Session Storage**: PostgreSQL-backed session store using connect-pg-simple

## Database Schema Design
- **Users**: Authentication and user management
- **Service Principals**: Azure service principal credentials and connection status
- **Cost Data**: Granular cost information by resource, service, and time period
- **Cost Summary**: Aggregated cost metrics, trends, and budget utilization data

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL storage backend
- **Service Principal Auth**: Azure service principal credentials for cloud API access
- **Security**: Sensitive data masking in API responses, secure credential storage

# External Dependencies

## Cloud Provider Integration
- **Azure**: Neon Database serverless adapter for Azure-compatible PostgreSQL
- **Service Principal Authentication**: Azure AD service principal credentials for cost management API access

## UI and Component Libraries
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide Icons**: Modern icon library with consistent design language
- **Font Awesome**: Additional icon set for cloud provider branding

## Development and Build Tools
- **Vite**: Fast development server and optimized production builds
- **TypeScript**: Static type checking across the entire stack
- **ESBuild**: Fast JavaScript bundler for server-side code
- **Replit Integration**: Development environment plugins for Replit platform

## Data Visualization
- **Recharts**: React charting library built on D3.js for interactive cost visualizations
- **Chart Components**: Line charts for cost trends, pie charts for service breakdowns

## Form and Validation
- **React Hook Form**: Performant forms with minimal re-renders
- **Zod**: Schema validation library for runtime type safety
- **Hookform Resolvers**: Integration between React Hook Form and Zod validation

The application uses a layered architecture with clear separation between presentation, business logic, and data access layers. The shared schema approach ensures type consistency across the full stack, while the storage abstraction allows for easy switching between different database implementations.