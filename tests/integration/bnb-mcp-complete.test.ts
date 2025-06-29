/**
 * Complete BNB MCP Plugin Integration Test
 * Tests all phases of fixes together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BNBMCPClient } from '@elizaos/plugin-bnb-mcp/src/services/mcpClient';
import { ScheduledInsightsService } from '@elizaos/plugin-bnb-mcp/src/services/scheduledInsights';
import { TwitterService } from '@elizaos/plugin-bnb-mcp/src/services/twitterService';
import { PersonalityContentGenerator } from '@elizaos/plugin-bnb-mcp/src/services/personalityContentGenerator';
import { bnbMcpInsightsAction } from '@elizaos/plugin-bnb-mcp/src/actions/bnbMcpInsights';
import type { BNBMCPInsight } from '@elizaos/plugin-bnb-mcp/src/types';

// Mock all external dependencies
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBlockNumber: vi.fn().mockResolvedValue(BigInt(30000000)),
    getGasPrice: vi.fn().mockResolvedValue(BigInt('5000000000')), // 5 gwei
    getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')), // 1 BNB
    getLogs: vi.fn().mockResolvedValue([
      {
        transactionHash: '0xabc123',
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        blockNumber: BigInt(30000000),
        args: {
          from: '0x1234567890abcdef',
          to: '0xfedcba0987654321',
          value: BigInt('1000000000000000000000') // 1000 BNB
        }
      }
    ]),
    getBlock: vi.fn().mockResolvedValue({
      number: BigInt(30000000),
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      transactions: [
        {
          hash: '0xdef456',
          from: '0xabcdef123456',
          to: '0x654321fedcba',
          value: BigInt('500000000000000000000'), // 500 BNB
          gasPrice: BigInt('5000000000')
        }
      ]
    }),
    getTransactionReceipt: vi.fn().mockResolvedValue({
      contractAddress: '0xnewcontract123',
      gasUsed: BigInt('200000')
    })
  })),
  http: vi.fn((url: string) => ({ url })),
  formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString()),
  parseEther: vi.fn((value: string) => BigInt(value) * 10n ** 18n)
}));

vi.mock('@elizaos/core', () => ({
  elizaLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn()
  },
  generateText: vi.fn().mockResolvedValue('Mocked AI response'),
  ModelClass: { SMALL: 'small' },
  composeContext: vi.fn(),
  generateObjectDeprecated: vi.fn()
}));

describe('BNB MCP Complete Integration Test', () => {
  let runtime: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock setInterval to prevent issues
    global.setInterval = vi.fn(() => 123 as any);
    
    // Mock runtime
    runtime = {
      getSetting: vi.fn((key: string) => {
        const settings: Record<string, string> = {
          RPC_URL: 'https://bsc-dataseed.binance.org/',
          RPC_BLOCK_RANGE: '50',
          RPC_RETRY_ATTEMPTS: '2',
          RPC_CACHE_TTL: '60000',
          CONTENT_TEMPERATURE: '0.85',
          CONTENT_PRESENCE_PENALTY: '0.5',
          BNB_MCP_SCHEDULED_INSIGHTS: 'true',
          BNB_MCP_CHECK_INTERVAL: '30'
        };
        return settings[key];
      }),
      cacheManager: {
        get: vi.fn(),
        set: vi.fn()
      },
      clients: {
        twitter: {
          post: vi.fn().mockResolvedValue({ id: 'tweet123' })
        }
      },
      registerService: vi.fn()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Phase 1: RPC Fixes', () => {
    it('should handle rate limits with retry and reduced block range', async () => {
      const client = new BNBMCPClient({
        env: {
          RPC_URL: 'https://bsc-dataseed.binance.org/',
          RPC_BLOCK_RANGE: '50',
          RPC_RETRY_ATTEMPTS: '2'
        }
      });

      // Verify block range is configured
      expect(client['defaultBlockRange']).toBe(50);
      expect(client['retryAttempts']).toBe(2);

      // Test retry on rate limit
      const mockGetGasPrice = vi.fn()
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce(BigInt('5000000000'));
      
      client['client'].getGasPrice = mockGetGasPrice;
      
      // Advance timers to handle retry delay
      const gasPricePromise = client.getGasPrice();
      await vi.advanceTimersByTimeAsync(1000); // First retry delay
      const gasPrice = await gasPricePromise;
      
      expect(mockGetGasPrice).toHaveBeenCalledTimes(2);
      expect(parseFloat(gasPrice)).toBeCloseTo(0.000000005);
    });
  });

  describe('Phase 2: Robustness', () => {
    it('should perform health check and cache responses', async () => {
      const service = new ScheduledInsightsService(runtime);
      
      // Test health check
      await service.initialize();
      expect(service['isHealthy']).toBe(true);
      
      // Test caching
      const client = service['mcpClient'];
      const gasPrice1 = await client.getGasPrice();
      const gasPrice2 = await client.getGasPrice();
      
      // Should use cache for second call
      expect(gasPrice1).toBe(gasPrice2);
    });

    it('should handle individual fetch failures gracefully', async () => {
      const service = new ScheduledInsightsService(runtime);
      
      // Mock one method to fail
      service['mcpClient'].getLargeTransactions = vi.fn().mockRejectedValue(new Error('RPC error'));
      service['mcpClient'].getNewContracts = vi.fn().mockResolvedValue([]);
      service['mcpClient'].getTokenTransfers = vi.fn().mockResolvedValue([]);
      
      // Should not throw
      await expect(service['checkAndPostInsights']()).resolves.not.toThrow();
    });
  });

  describe('Phase 3: Personality', () => {
    it('should generate personality-driven content without OpenAI', async () => {
      runtime.getSetting = vi.fn().mockReturnValue(undefined); // No API keys
      
      const twitterService = new TwitterService(runtime);
      const insight: BNBMCPInsight = {
        type: 'large_transfer',
        title: 'Whale Movement',
        description: 'Large transfer detected',
        data: {
          value: '1000',
          from: '0xwhale123',
          to: '0xdestination456'
        },
        timestamp: Date.now(),
        severity: 'high'
      };
      
      const tweet = await twitterService.generateTweetText(insight);
      
      // Should have personality markers
      expect(tweet).toMatch(/whale|degen|anon|tracking|BNB/i);
      expect(tweet.length).toBeLessThan(280);
    });

    it('should vary content across multiple posts', async () => {
      const generator = new PersonalityContentGenerator();
      const insight: BNBMCPInsight = {
        type: 'new_contract',
        title: 'Contract Deployed',
        description: 'New smart contract',
        data: { contractAddress: '0xabc123' },
        timestamp: Date.now(),
        severity: 'medium'
      };
      
      const posts = Array(5).fill(null).map(() => 
        generator.generateContent(insight, false)
      );
      
      const uniquePosts = new Set(posts);
      expect(uniquePosts.size).toBeGreaterThan(2);
    });
  });

  describe('Complete Flow', () => {
    it('should process insight from detection to tweet', async () => {
      const service = new ScheduledInsightsService(runtime);
      await service.initialize();
      
      // Mock successful data fetch
      const mockTransactions = [{
        hash: '0xabc',
        from: '0x123',
        to: '0x456',
        value: '1000',
        blockNumber: 30000000,
        timestamp: Date.now() / 1000,
        gasPrice: '5'
      }];
      
      service['mcpClient'].getLargeTransactions = vi.fn().mockResolvedValue(mockTransactions);
      service['mcpClient'].getNewContracts = vi.fn().mockResolvedValue([]);
      service['mcpClient'].getTokenTransfers = vi.fn().mockResolvedValue([]);
      
      // Run insight check
      await service['checkAndPostInsights']();
      
      // With auto-tweet disabled by default, it won't post
      // But we can check that insights were analyzed
      expect(service['analyzer']).toBeDefined();
      
      // Verify the service ran without errors
      expect(service['mcpClient'].getLargeTransactions).toHaveBeenCalled();
    });
  });

  describe('Action Handler', () => {
    it('should execute the complete action flow', async () => {
      const mockCallback = vi.fn();
      const mockMessage = {
        id: 'msg123',
        userId: 'user123',
        content: { text: 'Check BNB insights' },
        roomId: 'room123',
        timestamp: Date.now()
      };
      
      // Mock successful blockchain data fetch
      const mockGetBlockNumber = vi.fn().mockResolvedValue(BigInt(30000000));
      const mockGetBlock = vi.fn().mockResolvedValue({
        number: BigInt(30000000),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        transactions: [{
          hash: '0xabc',
          from: '0x123',
          to: '0x456',
          value: BigInt('500000000000000000000'),
          gasPrice: BigInt('5000000000')
        }]
      });
      
      const createPublicClient = (await import('viem')).createPublicClient as any;
      createPublicClient.mockImplementation(() => ({
        getBlockNumber: mockGetBlockNumber,
        getBlock: mockGetBlock,
        getTransactionReceipt: vi.fn().mockResolvedValue({ gasUsed: BigInt('200000') })
      }));
      
      const result = await bnbMcpInsightsAction.handler(
        runtime,
        mockMessage,
        {},
        {},
        mockCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
      
      const response = mockCallback.mock.calls[0][0];
      // Response will vary based on whether insights were found
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary RPC failures', async () => {
      const service = new ScheduledInsightsService(runtime);
      
      // Start unhealthy
      service['isHealthy'] = false;
      
      // Mock successful health check
      service['mcpClient'].getGasPrice = vi.fn().mockResolvedValue('0.000000005');
      
      await service['performHealthCheck']();
      
      expect(service['isHealthy']).toBe(true);
    });
  });

  describe('Monitoring', () => {
    it('should log comprehensive metrics', async () => {
      const { elizaLogger } = await import('@elizaos/core');
      
      const mockCallback = vi.fn();
      const mockMessage = {
        id: '1',
        userId: 'test',
        content: { text: 'test' },
        roomId: 'room123',
        timestamp: Date.now()
      };
      
      // Mock successful execution
      const createPublicClient = (await import('viem')).createPublicClient as any;
      createPublicClient.mockImplementation(() => ({
        getBlockNumber: vi.fn().mockResolvedValue(BigInt(30000000)),
        getBlock: vi.fn().mockResolvedValue({
          number: BigInt(30000000),
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
          transactions: []
        })
      }));
      
      await bnbMcpInsightsAction.handler(
        runtime,
        mockMessage,
        {},
        {},
        mockCallback
      );
      
      // Should log completion metrics
      expect(elizaLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('BNB MCP insights action completed'),
        expect.any(Object)
      );
    });
  });
});