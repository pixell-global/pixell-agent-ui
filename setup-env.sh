#!/bin/bash

# Setup script to create .env.dev from template
# This script helps set up the environment file for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Pixell Agent Framework - Environment Setup"
echo "============================================="
echo ""

# Check if .env.dev already exists
if [ -f ".env.dev" ]; then
    log_warning ".env.dev already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Keeping existing .env.dev file"
        exit 0
    fi
fi

# Check if template exists
if [ ! -f "env.dev.template" ]; then
    log_error "env.dev.template not found!"
    exit 1
fi

# Copy template to .env.dev
log_info "Creating .env.dev from template..."
cp env.dev.template .env.dev

log_success ".env.dev created successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env.dev and update the configuration values"
echo "2. Make sure NEXT_PUBLIC_PAF_CORE_AGENT_URL is set to your PAF core agent URL"
echo "3. Update Firebase configuration if needed"
echo "4. Run: ./deploy.sh --env dev"
echo ""
echo "🔧 Current PAF Core Agent URL in template:"
grep "NEXT_PUBLIC_PAF_CORE_AGENT_URL" .env.dev || echo "Not found in template"
echo ""
log_info "You can now edit .env.dev with your preferred editor"
