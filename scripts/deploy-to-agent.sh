#!/bin/bash
# ============================================================
# Mission Control Deployment Script
# ============================================================
# Usage: ./deploy-to-agent.sh <instance-id> <agent-name> [role]
# Example: ./deploy-to-agent.sh dev-manager-mini "Dev Manager" worker
# ============================================================

set -e

# Arguments
INSTANCE_ID=${1:-dev-manager-mini}
AGENT_NAME=${2:-"Dev Manager"}
ROLE=${3:-worker}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo "Mission Control Deployment"
echo "============================================================"
echo "Instance ID: $INSTANCE_ID"
echo "Agent Name: $AGENT_NAME"
echo "Role: $ROLE"
echo "============================================================"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not installed${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}ERROR: pnpm not installed. Run: npm install -g pnpm${NC}"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}ERROR: PM2 not installed. Run: npm install -g pm2${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Pull latest code
echo -e "${YELLOW}Pulling latest code...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Build
echo -e "${YELLOW}Building application...${NC}"
pnpm build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Configure environment
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    
    # Set instance-specific values
    sed -i.bak "s/MC_INSTANCE_ID=.*/MC_INSTANCE_ID=$INSTANCE_ID/" .env
    sed -i.bak "s/MC_INSTANCE_ROLE=.*/MC_INSTANCE_ROLE=$ROLE/" .env
    sed -i.bak "s/MC_AGENT_NAME=.*/MC_AGENT_NAME=$AGENT_NAME/" .env
    rm -f .env.bak
    
    echo -e "${GREEN}✓ .env configured for $AGENT_NAME${NC}"
else
    echo -e "${YELLOW}.env already exists, skipping configuration${NC}"
fi
echo ""

# Stop existing process if running
if pm2 describe mission-control &> /dev/null; then
    echo -e "${YELLOW}Stopping existing mission-control process...${NC}"
    pm2 stop mission-control
    pm2 delete mission-control
fi

# Start with PM2
echo -e "${YELLOW}Starting Mission Control with PM2...${NC}"
pm2 start npm --name "mission-control" -- start
pm2 save
echo -e "${GREEN}✓ Mission Control started${NC}"
echo ""

# Show PM2 status
pm2 status

echo ""
echo "============================================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "============================================================"
echo ""
echo "Dashboard: http://localhost:4000"
echo "Health Check: http://localhost:4000/api/health"
echo ""
echo "Useful commands:"
echo "  pm2 logs mission-control  - View logs"
echo "  pm2 restart mission-control - Restart"
echo "  pm2 stop mission-control    - Stop"
echo "============================================================"
