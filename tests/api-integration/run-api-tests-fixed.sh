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

# Navigate to project root
cd ../..

# Create test results directory
mkdir -p tests/api-integration/results

# Run specific test suites or all
if [ "$1" = "twitter" ]; then
    echo "🐦 Running Twitter API tests only..."
    npx vitest run tests/api-integration/twitter-real-api.test.ts --reporter=verbose
elif [ "$1" = "openai" ]; then
    echo "🤖 Running OpenAI API tests only..."
    npx vitest run tests/api-integration/openai-real-api.test.ts --reporter=verbose
elif [ "$1" = "bnb" ]; then
    echo "⛓️  Running BNB blockchain tests only..."
    npx vitest run tests/api-integration/bnb-blockchain-real-api.test.ts --reporter=verbose
elif [ "$1" = "combined" ]; then
    echo "🔄 Running combined integration tests..."
    npx vitest run tests/api-integration/combined-api.test.ts --reporter=verbose
else
    echo "🏃 Running all API integration tests..."
    echo ""
    
    # Run tests with detailed output
    npx vitest run tests/api-integration --reporter=verbose --bail=1
fi

# Save test results
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
else
    echo ""
    echo "❌ Some tests failed. Check the output above."
fi

echo ""
echo "💡 Tips:"
echo "   - Run './run-api-tests-fixed.sh twitter' to test only Twitter API"
echo "   - Run './run-api-tests-fixed.sh openai' to test only OpenAI API"
echo "   - Run './run-api-tests-fixed.sh bnb' to test only BNB blockchain"
echo "   - Run './run-api-tests-fixed.sh combined' to test integrated workflows"