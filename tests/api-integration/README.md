# API Integration Tests

These tests validate real API connections and functionality using actual credentials from your `.env` file.

## ⚠️ Important Notes

These tests make **REAL API calls** which:
- Consume API rate limits
- May incur costs (especially OpenAI)
- Require valid credentials in `.env`

## Available Tests

### 1. Twitter API Tests (`twitter-real-api.test.ts`)
- Verifies authentication
- Fetches timelines and user data
- Searches for crypto-related tweets
- Analyzes engagement metrics
- Tests rate limit handling

### 2. OpenAI API Tests (`openai-real-api.test.ts`)
- Lists available models
- Generates chat completions
- Creates embeddings
- Tests moderation API
- Simulates crypto content generation

### 3. BNB Blockchain Tests (`bnb-blockchain-real-api.test.ts`)
- Connects to BSC RPC
- Fetches block and transaction data
- Detects whale movements
- Analyzes DeFi activity
- Monitors gas prices

### 4. Combined Integration Tests (`combined-api.test.ts`)
- Tests complete Tutorial Agent workflow
- Combines blockchain monitoring with AI analysis
- Simulates tweet generation pipeline
- Validates API interoperability

## Running Tests

### Run all API tests:
```bash
./run-api-tests.sh
```

### Run specific test suite:
```bash
./run-api-tests.sh twitter    # Twitter only
./run-api-tests.sh openai     # OpenAI only
./run-api-tests.sh bnb        # BNB blockchain only
./run-api-tests.sh combined   # Combined workflows only
```

### Run with npm/pnpm:
```bash
# From the tests/api-integration directory
pnpm test twitter-real-api.test.ts
pnpm test openai-real-api.test.ts
pnpm test bnb-blockchain-real-api.test.ts
pnpm test combined-api.test.ts
```

## Required Environment Variables

Ensure these are set in your `.env` file:

### Twitter API
```env
TWITTER_AUTH_MODE=api_key
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

### OpenAI API
```env
OPENAI_API_KEY=sk-your-key
SMALL_OPENAI_MODEL=gpt-4o-mini
MEDIUM_OPENAI_MODEL=gpt-4o
EMBEDDING_OPENAI_MODEL=text-embedding-3-small
```

### BNB Blockchain
```env
BSC_PROVIDER_URL=https://bsc-dataseed.binance.org/
BNB_PRIVATE_KEY=dummy_key_not_used
```

## Test Output

Tests provide detailed output including:
- API connection status
- Response data samples
- Performance metrics
- Error handling validation

## Rate Limits & Costs

### Twitter API v2
- User timeline: 180 requests / 15 min
- Search tweets: 180 requests / 15 min
- User lookup: 300 requests / 15 min

### OpenAI API
- GPT-4o-mini: ~$0.15 / 1M input tokens
- GPT-4o: ~$2.50 / 1M input tokens
- Embeddings: ~$0.02 / 1M tokens

### BNB RPC
- Public endpoints: May have rate limits
- Consider using private RPC for production

## Troubleshooting

### Twitter API Errors
- **401 Unauthorized**: Check API credentials
- **429 Too Many Requests**: Rate limit exceeded
- **403 Forbidden**: Check app permissions

### OpenAI API Errors
- **401**: Invalid API key
- **429**: Rate limit or quota exceeded
- **503**: Service temporarily unavailable

### BNB RPC Errors
- **Connection refused**: Check RPC URL
- **Rate limit**: Use different RPC endpoint
- **Timeout**: Network issues or slow endpoint

## Best Practices

1. **Run sparingly**: These tests consume real resources
2. **Monitor costs**: Especially for OpenAI usage
3. **Use test data**: Don't test with production wallets
4. **Check rate limits**: Before running full suite
5. **Rotate endpoints**: If hitting RPC limits

## Adding New Tests

To add new API integration tests:

1. Create new test file: `your-api.test.ts`
2. Load environment variables
3. Initialize API client
4. Write tests with proper error handling
5. Update this README
6. Add to test runner script

Example structure:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Your API Tests', () => {
    let client: YourAPIClient;
    
    beforeAll(() => {
        if (!process.env.YOUR_API_KEY) {
            throw new Error('YOUR_API_KEY not found');
        }
        client = new YourAPIClient(process.env.YOUR_API_KEY);
    });
    
    it('should connect successfully', async () => {
        // Your test implementation
    });
});
```