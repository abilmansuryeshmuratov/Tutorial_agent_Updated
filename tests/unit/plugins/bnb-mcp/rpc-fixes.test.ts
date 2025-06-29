import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BNBMCPClient } from '@elizaos/plugin-bnb-mcp/src/services/mcpClient';

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
    error: vi.fn()
  }
}));

describe('BNB MCP Client RPC Fixes', () => {
  let client: BNBMCPClient;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Block Range Configuration', () => {
    it('should use default block range of 100', () => {
      client = new BNBMCPClient();
      expect(client['defaultBlockRange']).toBe(100);
    });

    it('should use custom block range from env', () => {
      client = new BNBMCPClient({
        env: { RPC_BLOCK_RANGE: '50' }
      });
      expect(client['defaultBlockRange']).toBe(50);
    });

    it('should handle invalid block range values', () => {
      client = new BNBMCPClient({
        env: { RPC_BLOCK_RANGE: 'invalid' }
      });
      expect(client['defaultBlockRange']).toBe(100);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on rate limit errors', async () => {
      const mockGetGasPrice = vi.fn()
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce(BigInt('1000000000'));

      client = new BNBMCPClient();
      client['client'].getGasPrice = mockGetGasPrice;

      const result = await client.getGasPrice();
      
      expect(mockGetGasPrice).toHaveBeenCalledTimes(2);
      expect(parseFloat(result)).toBeCloseTo(0.000000001); // 1 gwei in ETH
    });

    it('should use configurable retry attempts', async () => {
      const mockGetGasPrice = vi.fn()
        .mockRejectedValue(new Error('rate limit exceeded'));

      client = new BNBMCPClient({
        env: { RPC_RETRY_ATTEMPTS: '2' }
      });
      client['client'].getGasPrice = mockGetGasPrice;

      const result = await client.getGasPrice();
      
      expect(mockGetGasPrice).toHaveBeenCalledTimes(2);
      expect(result).toBe('0');
    });

    it('should not retry on non-rate-limit errors', async () => {
      const nonRateLimitError = new Error('invalid address');
      const mockGetGasPrice = vi.fn()
        .mockRejectedValue(nonRateLimitError);

      client = new BNBMCPClient();
      client['client'].getGasPrice = mockGetGasPrice;

      const result = await client.getGasPrice();
      
      // Non-rate-limit errors get caught and return default value
      expect(mockGetGasPrice).toHaveBeenCalledTimes(1);
      expect(result).toBe('0');
    });
  });

  describe('Token Transfers with Fixed Block Range', () => {
    it('should use configured block range for getLogs', async () => {
      const mockGetBlockNumber = vi.fn().mockResolvedValue(BigInt(1000));
      const mockGetLogs = vi.fn().mockResolvedValue([]);

      client = new BNBMCPClient({
        env: { RPC_BLOCK_RANGE: '50' }
      });
      client['client'].getBlockNumber = mockGetBlockNumber;
      client['client'].getLogs = mockGetLogs;

      await client.getTokenTransfers();

      expect(mockGetLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: BigInt(950), // 1000 - 50
          toBlock: BigInt(1000)
        })
      );
    });
  });
});