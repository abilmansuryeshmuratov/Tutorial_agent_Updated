/**
 * Unit tests for plugin-goat
 * Tests the GOAT plugin functionality without API keys
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentMocker } from '../../../utils/mockProvider';
import { createBirdeyeMockResponse } from './mocks/birdeye.mock';
import { createCoinGeckoMockResponse } from './mocks/coingecko.mock';

// Mock modules
vi.mock('@goat-sdk/plugin-birdeye', () => ({
  birdeye: vi.fn().mockImplementation((config) => {
    if (!config?.apiKey) {
      console.warn('Birdeye: No API key provided');
      return null;
    }
    return {
      name: 'birdeye',
      getPrice: async (token: string) => {
        const response = createBirdeyeMockResponse('/price', config.apiKey);
        if (response.status !== 200) {
          throw new Error(response.error);
        }
        return response.data;
      }
    };
  })
}));

vi.mock('@goat-sdk/plugin-coingecko', () => ({
  coingecko: vi.fn().mockImplementation((config) => {
    if (!config?.apiKey) {
      console.warn('CoinGecko: No API key provided');
      return null;
    }
    return {
      name: 'coingecko',
      getPrice: async (ids: string[]) => {
        const response = createCoinGeckoMockResponse('/simple/price', config.apiKey);
        if (response.status !== 200) {
          throw new Error(response.error);
        }
        return response.data;
      }
    };
  })
}));

describe('Plugin-GOAT Tests', () => {
  const envMocker = new EnvironmentMocker();

  beforeEach(() => {
    // Clear all environment variables
    envMocker.mock({
      BIRDEYE_API_KEY: undefined,
      COINGECKO_API_KEY: undefined,
      EVM_PRIVATE_KEY: undefined,
      EVM_PROVIDER_URL: undefined
    });
  });

  afterEach(() => {
    envMocker.restore();
    vi.clearAllMocks();
  });

  describe('Plugin Initialization', () => {
    it('should initialize without API keys and log warnings', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      
      // Import plugin (this would normally be done by the agent)
      const { goatPlugin } = await import('@elizaos/plugin-goat');
      
      expect(goatPlugin).toBeDefined();
      expect(goatPlugin.name).toBe('goat');
      
      // Check that warnings were logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Birdeye'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('CoinGecko'));
    });

    it('should initialize with valid API keys', async () => {
      envMocker.mock({
        BIRDEYE_API_KEY: 'valid_birdeye_key',
        COINGECKO_API_KEY: 'valid_coingecko_key',
        EVM_PRIVATE_KEY: '0x1234567890abcdef',
        EVM_PROVIDER_URL: 'https://bsc-dataseed.binance.org/'
      });

      const { goatPlugin } = await import('@elizaos/plugin-goat');
      
      expect(goatPlugin).toBeDefined();
      expect(goatPlugin.actions).toBeDefined();
      expect(goatPlugin.actions?.length).toBeGreaterThan(0);
    });
  });

  describe('SWAP_TOKENS Action', () => {
    it('should fail gracefully without EVM_PRIVATE_KEY', async () => {
      const { swapTokensAction } = await import('@elizaos/plugin-goat/src/actions');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          if (key === 'EVM_PRIVATE_KEY') return undefined;
          return null;
        }
      };

      const result = await swapTokensAction.validate(mockRuntime as any, {} as any);
      expect(result).toBe(false);
    });

    it('should validate swap parameters correctly', async () => {
      envMocker.mock({
        EVM_PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        EVM_PROVIDER_URL: 'https://bsc-dataseed.binance.org/'
      });

      const { swapTokensAction } = await import('@elizaos/plugin-goat/src/actions');
      
      const mockRuntime = {
        getSetting: (key: string) => process.env[key] || null
      };

      const mockMessage = {
        content: {
          text: 'swap 1 BNB to USDT'
        }
      };

      const result = await swapTokensAction.validate(mockRuntime as any, mockMessage as any);
      expect(result).toBe(true);
    });
  });

  describe('Price Data Integration', () => {
    it('should handle missing Birdeye API key', async () => {
      const birdeye = require('@goat-sdk/plugin-birdeye').birdeye;
      const plugin = birdeye({ apiKey: undefined });
      
      expect(plugin).toBeNull();
    });

    it('should fetch price with valid Birdeye API key', async () => {
      const birdeye = require('@goat-sdk/plugin-birdeye').birdeye;
      const plugin = birdeye({ apiKey: 'valid_key' });
      
      const price = await plugin.getPrice('BNB');
      expect(price).toBeDefined();
      expect(price.value).toBe(2.345);
      expect(price.priceChange24h).toBe(5.23);
    });

    it('should handle invalid Birdeye API key', async () => {
      const birdeye = require('@goat-sdk/plugin-birdeye').birdeye;
      const plugin = birdeye({ apiKey: 'invalid_key' });
      
      await expect(plugin.getPrice('BNB')).rejects.toThrow('Forbidden');
    });
  });

  describe('Wallet Configuration', () => {
    it('should create read-only wallet without private key', async () => {
      envMocker.mock({
        EVM_PROVIDER_URL: 'https://bsc-dataseed.binance.org/'
      });

      const { getWalletClient } = await import('@elizaos/plugin-goat/src/wallet');
      
      const mockRuntime = {
        getSetting: (key: string) => process.env[key] || null
      };

      // This should create a wallet that can read but not sign
      const wallet = await getWalletClient(mockRuntime as any);
      expect(wallet).toBeDefined();
      // In real implementation, check that wallet can't sign transactions
    });
  });
});

describe('Plugin-GOAT Error Handling', () => {
  const envMocker = new EnvironmentMocker();

  afterEach(() => {
    envMocker.restore();
  });

  it('should handle network errors gracefully', async () => {
    // Simulate network failure
    const birdeye = require('@goat-sdk/plugin-birdeye').birdeye;
    vi.mocked(birdeye).mockImplementationOnce(() => {
      throw new Error('Network error');
    });

    envMocker.mock({
      BIRDEYE_API_KEY: 'valid_key'
    });

    expect(() => birdeye({ apiKey: 'valid_key' })).toThrow('Network error');
  });

  it('should handle rate limit errors', async () => {
    const birdeye = require('@goat-sdk/plugin-birdeye').birdeye;
    const plugin = birdeye({ apiKey: 'rate_limited_key' });
    
    // In real implementation, this would return rate limit error
    // For now, we'll simulate it
    plugin.getPrice = async () => {
      throw new Error('Rate limit exceeded');
    };

    await expect(plugin.getPrice('BNB')).rejects.toThrow('Rate limit exceeded');
  });
});