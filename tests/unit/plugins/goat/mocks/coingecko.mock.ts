/**
 * CoinGecko API Mock Data
 */

export const mockCoinGeckoResponses = {
  // Simple price response
  simplePrice: {
    bitcoin: {
      usd: 45000,
      usd_24h_change: 2.5
    },
    ethereum: {
      usd: 2500,
      usd_24h_change: -1.2
    }
  },

  // Market data
  markets: [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      current_price: 45000,
      market_cap: 880000000000,
      market_cap_rank: 1,
      total_volume: 25000000000,
      high_24h: 46000,
      low_24h: 44000,
      price_change_24h: 1125,
      price_change_percentage_24h: 2.5,
      circulating_supply: 19500000,
      total_supply: 21000000
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      current_price: 2500,
      market_cap: 300000000000,
      market_cap_rank: 2,
      total_volume: 15000000000,
      high_24h: 2600,
      low_24h: 2450,
      price_change_24h: -30,
      price_change_percentage_24h: -1.2,
      circulating_supply: 120000000,
      total_supply: null
    }
  ],

  // Trending tokens
  trending: {
    coins: [
      {
        item: {
          id: 'pepe',
          coin_id: 27952,
          name: 'Pepe',
          symbol: 'PEPE',
          market_cap_rank: 50,
          thumb: 'https://example.com/pepe.png',
          price_btc: 0.00000001
        }
      }
    ]
  },

  // Error responses
  rateLimitError: {
    status: {
      error_code: 429,
      error_message: 'You have exceeded the rate limit'
    }
  }
};

// Helper to create CoinGecko API mock responses
export function createCoinGeckoMockResponse(endpoint: string, apiKey?: string) {
  // No API key (some endpoints work without key)
  const requiresAuth = endpoint.includes('/pro/') || endpoint.includes('x-cg-pro-api-key');
  
  if (requiresAuth && !apiKey) {
    return {
      status: 401,
      error: 'API key required for this endpoint',
      data: null
    };
  }

  // Invalid API key
  if (apiKey === 'invalid_key') {
    return {
      status: 403,
      error: 'Invalid API key',
      data: null
    };
  }

  // Mock endpoints
  if (endpoint.includes('/simple/price')) {
    return {
      status: 200,
      data: mockCoinGeckoResponses.simplePrice
    };
  }

  if (endpoint.includes('/coins/markets')) {
    return {
      status: 200,
      data: mockCoinGeckoResponses.markets
    };
  }

  if (endpoint.includes('/search/trending')) {
    return {
      status: 200,
      data: mockCoinGeckoResponses.trending
    };
  }

  // Default 404
  return {
    status: 404,
    error: 'Endpoint not found',
    data: null
  };
}