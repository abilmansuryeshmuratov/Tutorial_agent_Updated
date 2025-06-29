# BNB MCP Plugin - RPC Fixes Documentation

## Phase 1 Fixes Implemented

### 1. Configurable Block Range
- **Previous Issue**: Hard-coded 1000 block range causing rate limits
- **Fix**: Reduced default to 100 blocks, made configurable via `RPC_BLOCK_RANGE` env variable
- **Impact**: Prevents `LimitExceededRpcError` on public RPC endpoints

### 2. Retry Logic with Exponential Backoff
- **Previous Issue**: No retry mechanism for rate-limited requests
- **Fix**: Implemented retry wrapper with exponential backoff (1s, 2s, 4s delays)
- **Impact**: Gracefully handles temporary rate limits without failing

### 3. Enhanced Configuration Options
- **Previous Issue**: No way to configure retry behavior
- **Fix**: Added support for `RPC_RETRY_ATTEMPTS` env variable
- **Impact**: Users can adjust retry behavior based on their RPC provider

## Environment Variables

```bash
# RPC endpoint URL (use private RPC for better performance)
RPC_URL=https://rpc.ankr.com/bsc/YOUR_API_KEY

# Block range for queries (default: 100)
RPC_BLOCK_RANGE=100

# Number of retry attempts for rate-limited requests (default: 3)
RPC_RETRY_ATTEMPTS=3
```

## Usage Example

```typescript
// The plugin will automatically use these settings
const config = {
  env: {
    RPC_URL: process.env.RPC_URL,
    RPC_BLOCK_RANGE: process.env.RPC_BLOCK_RANGE,
    RPC_RETRY_ATTEMPTS: process.env.RPC_RETRY_ATTEMPTS
  }
};
```

## Behavior

1. **Rate Limit Detection**: The client detects rate limits by checking for:
   - Error messages containing "limit" or "rate"
   - Error code -32005

2. **Retry Strategy**:
   - Only retries on rate limit errors
   - Non-rate-limit errors fail immediately
   - Exponential backoff prevents overwhelming the RPC

3. **Graceful Degradation**:
   - Returns empty arrays for failed list queries
   - Returns "0" for failed value queries
   - Logs detailed error information for debugging

## Testing

Run the test suite to verify the fixes:
```bash
npm test tests/unit/plugins/bnb-mcp/rpc-fixes.test.ts
```

## Next Steps (Phase 2-4)

- Phase 2: Add caching layer to reduce RPC calls
- Phase 3: Improve content generation personality
- Phase 4: Add comprehensive monitoring