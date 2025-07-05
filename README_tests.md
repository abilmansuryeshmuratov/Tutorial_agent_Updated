# Tutorial Agent Testing Guide

This comprehensive guide covers all testing aspects of the Tutorial Agent, including unit tests, integration tests, and API tests.

## Table of Contents
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [API Integration Tests](#api-integration-tests)
- [Twitter Developer Setup](#twitter-developer-setup)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

## Test Structure

The test suite is organized into three main categories:

```
tests/
├── unit/                    # Unit tests with mocks
│   ├── clients/            # Client-specific tests
│   │   ├── telegram/
│   │   └── twitter/
│   └── plugins/            # Plugin tests
│       ├── bnb-mcp/
│       ├── goat/
│       └── twitter-moderation/
├── integration/            # Integration tests
│   ├── agent-startup.test.ts
│   ├── message-flow.test.ts
│   └── plugin-loading.test.ts
├── api-integration/        # Real API tests
│   ├── twitter-real-api.test.ts
│   ├── openai-real-api.test.ts
│   ├── bnb-blockchain-real-api.test.ts
│   └── combined-api.test.ts
└── utils/                  # Test utilities
```

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run only passing tests (no API keys required)
cd tests && ./run-working-tests.sh

# Run specific test file
npx vitest run tests/unit/clients/twitter/twitter-client-integration.test.ts

# Run tests in watch mode
npx vitest watch

# Run tests with coverage
npx vitest run --coverage
```

### Test Categories

#### 1. Unit Tests (No API Keys Required)
These tests use mocks and don't require any external services:

```bash
# Run all unit tests
npx vitest run tests/unit

# Run specific unit test suites
npx vitest run tests/unit/clients/twitter
npx vitest run tests/unit/plugins/bnb-mcp
```

#### 2. Integration Tests (No API Keys Required)
These test component interactions without external APIs:

```bash
# Run all integration tests
npx vitest run tests/integration

# Run specific integration test
npx vitest run tests/integration/simple-pipeline.test.ts
```

#### 3. API Integration Tests (Requires API Keys)
These tests make real API calls and require valid credentials:

```bash
# Navigate to API test directory
cd tests/api-integration

# Run all API tests
./run-api-tests.sh

# Run specific API tests
./run-api-tests.sh twitter    # Twitter only
./run-api-tests.sh openai     # OpenAI only
./run-api-tests.sh bnb        # BNB blockchain only
./run-api-tests.sh combined   # Combined workflows
```

## API Integration Tests

### Prerequisites

API integration tests require valid credentials in your `.env` file:

```env
# Twitter API (required for Twitter tests)
TWITTER_AUTH_MODE=api_key
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret

# OpenAI API (required for AI tests)
OPENAI_API_KEY=sk-your-key
SMALL_OPENAI_MODEL=gpt-4o-mini
MEDIUM_OPENAI_MODEL=gpt-4o

# BNB Blockchain (required for blockchain tests)
BSC_PROVIDER_URL=https://bsc-dataseed.binance.org/
BNB_PRIVATE_KEY=dummy_key_not_used
```

### What API Tests Cover

1. **Twitter API Tests**
   - Authentication verification
   - Timeline fetching
   - User operations
   - Tweet search
   - Rate limit handling

2. **OpenAI API Tests**
   - Model availability
   - Chat completions
   - Embeddings
   - Content moderation
   - Function calling

3. **BNB Blockchain Tests**
   - Chain connectivity
   - Block analysis
   - Transaction monitoring
   - Token operations
   - DeFi activity

4. **Combined Tests**
   - Full Tutorial Agent workflow
   - Blockchain + AI integration
   - Market sentiment analysis

## Twitter Developer Setup

### ⚠️ Important: Project Requirements

As of 2024, Twitter requires all API v2 access to be through apps attached to a Project. If you're getting a "Client Forbidden" error, follow these steps:

### Step 1: Create a Twitter Developer Account
1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Apply for developer access if you haven't already
3. Complete the application process

### Step 2: Create a Project
1. Navigate to the [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Click "Projects & Apps" in the sidebar
3. Click "New Project"
4. Fill in project details:
   - **Project Name**: e.g., "Tutorial Agent Bot"
   - **Project Description**: Describe your bot's purpose
   - **Use Case**: Select appropriate category (e.g., "Making a bot")

### Step 3: Create or Attach an App
1. After creating the project, you'll be prompted to create an app
2. If you have an existing app:
   - Go to "Projects & Apps" → Your Project
   - Click "Add App"
   - Select your existing app
3. For new apps:
   - Choose app environment (Development/Production)
   - Enter app name

### Step 4: Get API Credentials
1. In your app settings, navigate to "Keys and tokens"
2. Generate/Regenerate:
   - API Key and Secret (Consumer Keys)
   - Access Token and Secret
3. Save these credentials securely

### Step 5: Configure Authentication
Add to your `.env` file:
```env
TWITTER_AUTH_MODE=api_key
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```

### Step 6: Verify Access Level
1. Check your app's access level in the portal
2. Ensure it has at least "Read and Write" permissions
3. For advanced features, you may need "Elevated" access

### Common Issues

1. **403 Client Forbidden Error**
   - Your app is not attached to a Project
   - Solution: Follow steps 2-3 above

2. **429 Rate Limit Error**
   - You've exceeded API rate limits
   - Solution: Wait 15 minutes or implement rate limiting

3. **401 Unauthorized**
   - Invalid credentials
   - Solution: Regenerate and update your keys

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root with these variables:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-key
SMALL_OPENAI_MODEL=gpt-4o-mini
MEDIUM_OPENAI_MODEL=gpt-4o
LARGE_OPENAI_MODEL=gpt-4o
EMBEDDING_OPENAI_MODEL=text-embedding-3-small

# Twitter Configuration
TWITTER_AUTH_MODE=api_key
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_TOKEN_SECRET=your_token_secret
TWITTER_DRY_RUN=false

# BNB Configuration
BNB_PRIVATE_KEY=dummy_key_not_used
BSC_PROVIDER_URL=https://bsc-dataseed.binance.org/
BNB_MCP_SCHEDULED_INSIGHTS=true
BNB_MCP_CHECK_INTERVAL=30
BNB_MCP_AUTO_TWEET=true

# Optional: Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_GROUP_IDS=group1,group2
```

### Rate Limits & Costs

Be aware of API limitations:

**Twitter API v2**
- User timeline: 180 requests / 15 min
- Tweet creation: 200 tweets / 15 min
- Search tweets: 180 requests / 15 min

**OpenAI API**
- GPT-4o-mini: ~$0.15 / 1M input tokens
- GPT-4o: ~$2.50 / 1M input tokens
- Rate limits vary by tier

**BNB RPC**
- Public endpoints may have rate limits
- Consider private RPC for production

## Troubleshooting

### Common Test Failures

1. **Module Not Found Errors**
   ```bash
   # Install dependencies
   npm install
   
   # If specific package missing
   npm install missing-package-name
   ```

2. **API Key Issues**
   ```bash
   # Verify .env file exists
   ls -la .env
   
   # Check if keys are loaded
   node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY ? 'OpenAI key found' : 'OpenAI key missing')"
   ```

3. **Rate Limit Errors**
   - Wait 15 minutes for Twitter rate limits to reset
   - The production code now includes automatic rate limit handling
   - Check `tests/api-integration/rateLimit.ts` for implementation

4. **TypeScript Errors**
   ```bash
   # Rebuild the project
   npm run build
   
   # Check TypeScript configuration
   npx tsc --noEmit
   ```

### Debug Mode

Run tests with debug output:
```bash
# Set debug environment variable
DEBUG=* npx vitest run tests/api-integration/twitter-real-api.test.ts

# Or use Vitest's built-in debugging
npx vitest run tests/api-integration/twitter-real-api.test.ts --reporter=verbose
```

### Test Isolation

If tests are interfering with each other:
```bash
# Run tests sequentially instead of in parallel
npx vitest run --no-threads

# Run a single test file
npx vitest run tests/api-integration/openai-real-api.test.ts
```

## Best Practices

1. **API Key Security**
   - Never commit `.env` files
   - Use environment-specific configs
   - Rotate keys regularly

2. **Test Data**
   - Use test accounts for Twitter
   - Monitor API usage and costs
   - Clean up test data when done

3. **Rate Limiting**
   - Implement backoff strategies
   - Cache API responses when possible
   - Use mock data for development

4. **Continuous Integration**
   - Run unit tests in CI
   - API tests only in staging/production
   - Monitor test coverage

## Contributing

When adding new tests:

1. **Unit Tests**: Always use mocks, no external dependencies
2. **Integration Tests**: Test component interactions
3. **API Tests**: Document required credentials and costs
4. **Documentation**: Update this README with new test information

### Test Naming Convention
- `*.test.ts` - Standard test files
- `*.mock.ts` - Mock implementations
- `*-real-api.test.ts` - Tests that make real API calls

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [BSC RPC Documentation](https://docs.bnbchain.org/docs/rpc)

## Support

For test-related issues:
- Check existing issues in the repository
- Review test output carefully
- Verify all environment variables
- Ensure API credentials are valid and have proper permissions

Remember: API integration tests cost money and consume rate limits. Use them judiciously!