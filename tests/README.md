# Eliza Test Suite - API Signature Testing

This test suite validates the entire Eliza pipeline without requiring any API keys. It uses comprehensive mocks to simulate API responses and verify that the system behaves correctly in their absence.

## Test Structure

```
tests/
├── unit/                       # Unit tests for individual components
│   ├── plugins/
│   │   ├── goat/              # GOAT plugin tests
│   │   │   ├── plugin.test.ts
│   │   │   └── mocks/
│   │   │       ├── birdeye.mock.ts
│   │   │       └── coingecko.mock.ts
│   │   ├── bnb-mcp/           # BNB MCP plugin tests
│   │   │   ├── plugin.test.ts
│   │   │   └── mocks/
│   │   │       └── rpc.mock.ts
│   │   └── twitter-moderation/ # Twitter moderation tests
│   │       ├── plugin.test.ts
│   │       └── mocks/
│   │           └── openai.mock.ts
├── integration/                # End-to-end tests
│   ├── agent-startup.test.ts
│   ├── plugin-loading.test.ts
│   └── message-flow.test.ts
└── utils/                      # Test utilities
    └── mockProvider.ts
```

## Running Tests

### Quick Start
```bash
# Run all tests without API keys
./tests/run-tests.sh

# Or use npm scripts
pnpm test:no-keys
```

### Individual Test Commands
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run signature/mock tests
pnpm test:signatures

# Generate coverage report
pnpm test:coverage
```

## API Mocks

### 1. Birdeye API Mock
- Simulates token price responses
- Handles authentication errors
- Provides realistic market data

### 2. CoinGecko API Mock
- Simulates cryptocurrency market data
- Supports both standard and pro API responses
- Includes trending tokens and price data

### 3. BSC RPC Mock
- Simulates blockchain queries
- Provides transaction, block, and gas price data
- Works with viem client

### 4. OpenAI Moderation Mock
- Simulates content moderation responses
- Tests different flagging scenarios
- Handles API failures gracefully

## Expected Behaviors Without API Keys

### Plugin-GOAT
- **Without BIRDEYE_API_KEY**: Logs warning, skips price lookups
- **Without COINGECKO_API_KEY**: Uses alternative data source
- **Without EVM_PRIVATE_KEY**: Read-only mode, no transactions

### Plugin-BNB-MCP
- **Without RPC_URL**: Uses public BSC endpoint
- Generates sample insights from mock data
- Twitter posting in dry-run mode

### Twitter Moderation
- **Without OPENAI_API_KEY**: Allows all content (fail-open)
- Logs moderation skip with reason

## Test Coverage

The test suite covers:
1. ✅ Plugin initialization without keys
2. ✅ API response signature validation
3. ✅ Error handling and graceful degradation
4. ✅ Message flow processing
5. ✅ Integration between components
6. ✅ Configuration validation
7. ✅ Fallback behavior

## Adding New Tests

To add tests for a new API:

1. Create mock data in `tests/unit/plugins/[plugin-name]/mocks/`
2. Add unit tests in `tests/unit/plugins/[plugin-name]/`
3. Update integration tests if needed
4. Document expected behavior without API keys

## Mock Response Examples

### Birdeye Price Response
```json
{
  "value": 2.345,
  "updateUnixTime": 1719612345,
  "priceChange24h": 5.23
}
```

### OpenAI Moderation Response
```json
{
  "id": "modr-123",
  "model": "text-moderation-007",
  "results": [{
    "categories": {
      "hate": false,
      "violence": false
    },
    "category_scores": {
      "hate": 0.001,
      "violence": 0.002
    },
    "flagged": false
  }]
}
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines without requiring secrets:
```yaml
- name: Run Tests
  run: pnpm test:no-keys
```

## Troubleshooting

### Tests Failing
1. Ensure no API keys are set in environment
2. Check mock data matches expected signatures
3. Verify plugin versions are correct

### Adding API Keys for Full Testing
To test with real APIs, create a `.env.test` file:
```env
OPENAI_API_KEY=your_key
BIRDEYE_API_KEY=your_key
COINGECKO_API_KEY=your_key
```

Then run: `pnpm test`