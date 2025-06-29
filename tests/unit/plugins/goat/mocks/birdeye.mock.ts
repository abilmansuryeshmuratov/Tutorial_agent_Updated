/**
 * Birdeye API Mock Data
 */

export const mockBirdeyeResponses = {
  // Token price response
  tokenPrice: {
    value: 2.345,
    updateUnixTime: 1719612345,
    updateHumanTime: '2024-06-29T00:00:00Z',
    priceChange24h: 5.23,
    priceChange24hPercent: 2.28
  },

  // Token metadata
  tokenMetadata: {
    address: '0x1234567890abcdef',
    symbol: 'TEST',
    name: 'Test Token',
    decimals: 18,
    logoURI: 'https://example.com/logo.png',
    coingeckoId: 'test-token',
    totalSupply: '1000000000000000000000000'
  },

  // Market data
  marketData: {
    price: 2.345,
    priceChange24h: 5.23,
    volume24h: 1234567.89,
    marketCap: 23456789.01,
    holders: 12345,
    liquidity: 3456789.01
  },

  // Error responses
  invalidToken: {
    error: 'Token not found',
    code: 'TOKEN_NOT_FOUND'
  },

  rateLimitError: {
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  }
};

// Helper to create Birdeye API mock responses
export function createBirdeyeMockResponse(endpoint: string, apiKey?: string) {
  // No API key
  if (!apiKey) {
    return {
      status: 401,
      error: 'Unauthorized: Missing API key',
      data: null
    };
  }

  // Invalid API key
  if (apiKey === 'invalid_key') {
    return {
      status: 403,
      error: 'Forbidden: Invalid API key',
      data: null
    };
  }

  // Mock endpoints
  if (endpoint.includes('/price')) {
    return {
      status: 200,
      data: mockBirdeyeResponses.tokenPrice
    };
  }

  if (endpoint.includes('/metadata')) {
    return {
      status: 200,
      data: mockBirdeyeResponses.tokenMetadata
    };
  }

  if (endpoint.includes('/market')) {
    return {
      status: 200,
      data: mockBirdeyeResponses.marketData
    };
  }

  // Default 404
  return {
    status: 404,
    error: 'Endpoint not found',
    data: null
  };
}