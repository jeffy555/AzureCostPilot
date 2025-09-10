#!/bin/bash

# Cloud Cost Management Dashboard - Local Setup Script
# This script sets up and starts the application on your local machine

set -e

echo "🚀 Setting up Cloud Cost Management Dashboard locally..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
print_status "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js $(node --version) is installed"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

print_success "npm $(npm --version) is installed"

# Install dependencies
print_status "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cat > .env << 'EOF'
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
EOF
    print_warning "Created .env file with template values. Please update with your actual credentials."
    print_warning "Edit .env file and add your Azure and MongoDB Atlas credentials before running the app."
else
    print_success ".env file already exists"
fi

# Check if PostgreSQL is running (optional)
print_status "Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        print_success "PostgreSQL is running"
    else
        print_warning "PostgreSQL is not running. The app will use in-memory storage."
    fi
else
    print_warning "PostgreSQL not found. The app will use in-memory storage."
fi

# Start the application
print_status "Starting the Cloud Cost Management Dashboard..."
print_status "The application will be available at: http://localhost:9003"
print_status "Press Ctrl+C to stop the application"

echo ""
echo "=================================="
echo "🌟 Cloud Cost Management Dashboard"
echo "=================================="
echo "📊 Frontend: http://localhost:9003"
echo "🔗 API: http://localhost:9003/api"
echo "📚 MongoDB View: http://localhost:9003/mongodb"
echo "☁️  Azure View: http://localhost:9003/azure"
echo "=================================="
echo ""

# Start the development server
npm run dev