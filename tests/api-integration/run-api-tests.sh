#!/bin/bash

# Script to run API integration tests with real API calls
# These tests use actual API credentials from .env file

echo "🚀 Running Tutorial Agent API Integration Tests"
echo "=============================================="
echo ""
echo "⚠️  WARNING: These tests make REAL API calls!"
echo "   - Twitter API (rate limits apply)"
echo "   - OpenAI API (costs tokens/money)"
echo "   - BNB Chain RPC (may have rate limits)"
echo ""
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

# Set test environment
export NODE_ENV=test
export VITEST_UI=false

# Load environment variables
if [ -f "../../.env" ]; then
    echo "✅ Loading environment variables from .env"
    export $(cat ../../.env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Create test results directory
mkdir -p results

# Run specific test suites or all
if [ "$1" = "twitter" ]; then
    echo "🐦 Running Twitter API tests only..."
    npx vitest run twitter-real-api.test.ts --reporter=verbose
elif [ "$1" = "openai" ]; then
    echo "🤖 Running OpenAI API tests only..."
    npx vitest run openai-real-api.test.ts --reporter=verbose
elif [ "$1" = "bnb" ]; then
    echo "⛓️  Running BNB blockchain tests only..."
    npx vitest run bnb-blockchain-real-api.test.ts --reporter=verbose
elif [ "$1" = "combined" ]; then
    echo "🔄 Running combined integration tests..."
    npx vitest run combined-api.test.ts --reporter=verbose
else
    echo "🏃 Running all API integration tests..."
    echo ""
    
    # Run tests with detailed output
    npx vitest run . --reporter=verbose --bail=1
fi

# Save test results
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    echo "Results saved to: results/api-test-$(date +%Y%m%d-%H%M%S).log"
else
    echo ""
    echo "❌ Some tests failed. Check the output above."
fi

echo ""
echo "💡 Tips:"
echo "   - Run './run-api-tests.sh twitter' to test only Twitter API"
echo "   - Run './run-api-tests.sh openai' to test only OpenAI API"
echo "   - Run './run-api-tests.sh bnb' to test only BNB blockchain"
echo "   - Run './run-api-tests.sh combined' to test integrated workflows"
echo ""
echo "📊 API Usage Notes:"
echo "   - Twitter: Subject to rate limits (15-180 requests per 15 min window)"
echo "   - OpenAI: Each test uses tokens (costs money)"
echo "   - BNB RPC: Free tier may have rate limits"