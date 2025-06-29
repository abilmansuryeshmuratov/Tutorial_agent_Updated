import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BNBMCPClient } from '@elizaos/plugin-bnb-mcp/src/services/mcpClient';
import { ScheduledInsightsService } from '@elizaos/plugin-bnb-mcp/src/services/scheduledInsights';

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBlockNumber: vi.fn(),
    getGasPrice: vi.fn(),
    getBalance: vi.fn(),
    getLogs: vi.fn(),
    readContract: vi.fn()
  })),
  http: vi.fn((url: string) => ({ url })),
  formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString())
}));

// Mock elizaLogger
vi.mock('@elizaos/core', () => ({
  elizaLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Phase 2 Improvements', () => {
  let client: BNBMCPClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Caching Layer', () => {
    it('should cache gas price responses', async () => {
      const mockGetGasPrice = vi.fn().mockResolvedValue(BigInt('1000000000'));
      
      client = new BNBMCPClient({
        env: { RPC_CACHE_TTL: '60000' } // 1 minute
      });
      client['client'].getGasPrice = mockGetGasPrice;

      // First call should hit RPC
      const result1 = await client.getGasPrice();
      expect(mockGetGasPrice).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await client.getGasPrice();
      expect(mockGetGasPrice).toHaveBeenCalledTimes(1); // Still 1
      expect(result1).toBe(result2);
    });

    it('should expire cache after TTL', async () => {
      const mockGetGasPrice = vi.fn().mockResolvedValue(BigInt('1000000000'));
      
      client = new BNBMCPClient({
        env: { RPC_CACHE_TTL: '1000' } // 1 second
      });
      client['client'].getGasPrice = mockGetGasPrice;

      // First call
      await client.getGasPrice();
      expect(mockGetGasPrice).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      // Should hit RPC again
      await client.getGasPrice();
      expect(mockGetGasPrice).toHaveBeenCalledTimes(2);
    });

    it('should cache token balances separately', async () => {
      const mockGetBalance = vi.fn().mockResolvedValue(BigInt('1000000000000000000'));
      const mockReadContract = vi.fn().mockResolvedValue(BigInt('2000000000000000000'));
      
      client = new BNBMCPClient();
      client['client'].getBalance = mockGetBalance;
      client['client'].readContract = mockReadContract;

      // Get BNB balance
      await client.getTokenBalance('0x123');
      expect(mockGetBalance).toHaveBeenCalledTimes(1);

      // Get token balance
      await client.getTokenBalance('0x123', '0x456');
      expect(mockReadContract).toHaveBeenCalledTimes(1);

      // Both should be cached
      await client.getTokenBalance('0x123');
      await client.getTokenBalance('0x123', '0x456');
      
      expect(mockGetBalance).toHaveBeenCalledTimes(1); // Still 1
      expect(mockReadContract).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Health Checks', () => {
    it('should perform health check on service initialization', async () => {
      const mockRuntime = {
        getSetting: vi.fn((key: string) => {
          if (key === 'BNB_MCP_SCHEDULED_INSIGHTS') return 'true';
          return undefined;
        }),
        cacheManager: null,
        registerService: vi.fn()
      };

      const mockGetGasPrice = vi.fn().mockResolvedValue(BigInt('1000000000'));
      const mockGetBlockNumber = vi.fn().mockResolvedValue(BigInt('1000000'));

      const service = new ScheduledInsightsService(mockRuntime as any);
      service['mcpClient']['client'].getGasPrice = mockGetGasPrice;
      service['mcpClient']['client'].getBlockNumber = mockGetBlockNumber;

      await service.initialize();

      // Should have performed health check
      expect(service['isHealthy']).toBe(true);
      expect(service['lastHealthCheck']).toBeGreaterThan(0);
    });

    it('should mark service unhealthy on RPC failure', async () => {
      const mockRuntime = {
        getSetting: vi.fn((key: string) => {
          if (key === 'BNB_MCP_SCHEDULED_INSIGHTS') return 'true';
          return undefined;
        }),
        cacheManager: null,
        registerService: vi.fn()
      };

      const service = new ScheduledInsightsService(mockRuntime as any);
      
      // Mock RPC failure
      service['mcpClient'].getGasPrice = vi.fn().mockRejectedValue(new Error('RPC error'));

      await service.initialize();

      expect(service['isHealthy']).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle individual fetch failures gracefully', async () => {
      const mockRuntime = {
        getSetting: vi.fn(),
        cacheManager: null,
        registerService: vi.fn()
      };

      const service = new ScheduledInsightsService(mockRuntime as any);
      
      // Mock one method to fail
      service['mcpClient'].getLargeTransactions = vi.fn().mockRejectedValue(new Error('Failed'));
      service['mcpClient'].getNewContracts = vi.fn().mockResolvedValue([]);
      service['mcpClient'].getTokenTransfers = vi.fn().mockResolvedValue([]);

      // Should not throw
      await expect(service['checkAndPostInsights']()).resolves.not.toThrow();
    });
  });

  describe('Monitoring', () => {
    it('should log detailed metrics', async () => {
      const { elizaLogger } = await import('@elizaos/core');
      
      client = new BNBMCPClient({
        env: { 
          RPC_BLOCK_RANGE: '50',
          RPC_RETRY_ATTEMPTS: '2',
          RPC_CACHE_TTL: '300000'
        }
      });

      // Check initialization logs
      expect(elizaLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('BNB MCP Client initialized')
      );
    });
  });
});