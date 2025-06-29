#!/bin/bash

echo "================================================"
echo "Eliza Pipeline Test Suite - No API Keys Required"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Clear any existing API keys for testing
echo -e "${YELLOW}Clearing environment variables...${NC}"
unset OPENAI_API_KEY
unset BIRDEYE_API_KEY
unset COINGECKO_API_KEY
unset EVM_PRIVATE_KEY
unset EVM_PROVIDER_URL
unset RPC_URL

echo "Environment cleared."
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pnpm install
fi

# Run different test suites
echo -e "${GREEN}1. Running Unit Tests${NC}"
echo "========================"
pnpm test:unit

echo ""
echo -e "${GREEN}2. Running Integration Tests${NC}"
echo "============================="
pnpm test:integration

echo ""
echo -e "${GREEN}3. Running All Tests Without API Keys${NC}"
echo "====================================="
pnpm test:no-keys

echo ""
echo -e "${GREEN}4. Running Signature Tests${NC}"
echo "=========================="
pnpm test:signatures

echo ""
echo -e "${GREEN}5. Running Full Pipeline Test${NC}"
echo "============================="
pnpm test tests/integration/full-pipeline.test.ts

echo ""
echo -e "${GREEN}6. Generating Coverage Report${NC}"
echo "============================="
pnpm test:coverage

echo ""
echo "================================================"
echo -e "${GREEN}Test Suite Complete!${NC}"
echo "================================================"
echo ""
echo "Summary:"
echo "- All tests run without API keys"
echo "- Mock providers simulate API responses"
echo "- System gracefully degrades when keys are missing"
echo ""
echo "To run specific tests:"
echo "  pnpm test:unit          - Run unit tests only"
echo "  pnpm test:integration   - Run integration tests only"
echo "  pnpm test:no-keys       - Run all tests with empty API keys"
echo "  pnpm test:watch         - Run tests in watch mode"
echo ""