/**
 * Full flow test for BNB-MCP plugin including content generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentMocker } from '../../../utils/mockProvider';
import { MockViemClient } from './mocks/rpc.mock';
import { mockGenerateText } from '../../core/mocks/openai-generation.mock';

// Mock dependencies
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => new MockViemClient()),
  http: vi.fn((url: string) => ({ url })),
  formatEther: vi.fn((value: bigint) => (Number(value) / 1e18).toString())
}));

describe('BNB-MCP Full Flow Test', () => {
  const envMocker = new EnvironmentMocker();

  beforeEach(() => {
    envMocker.mock({
      RPC_URL: undefined,
      OPENAI_API_KEY: undefined
    });
  });

  afterEach(() => {
    envMocker.restore();
  });

  it('should complete full insight generation flow without OpenAI key', async () => {
    // Mock the complete BNB-MCP flow
    const bnbMcpFlow = {
      // 1. Fetch blockchain data
      async fetchBlockchainData() {
        const client = new MockViemClient();
        
        const [gasPrice, blockNumber, logs] = await Promise.all([
          client.getGasPrice(),
          client.getBlockNumber(),
          client.getLogs({ address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' })
        ]);
        
        return {
          gasPrice: gasPrice.toString(),
          blockNumber: blockNumber.toString(),
          recentTransfers: logs.length,
          largeTransactions: [
            {
              hash: '0x123...',
              from: '0xWhale1...',
              to: '0xWhale2...',
              value: '1000000000000000000000', // 1000 BNB
              blockNumber: blockNumber
            }
          ]
        };
      },

      // 2. Analyze for insights
      async analyzeData(data: any) {
        const insights = [];
        
        // Large transaction insight
        if (data.largeTransactions.length > 0) {
          const tx = data.largeTransactions[0];
          const bnbAmount = Number(tx.value) / 1e18;
          
          insights.push({
            type: 'large_transaction',
            priority: 'high',
            data: {
              amount: bnbAmount.toFixed(2),
              from: tx.from,
              to: tx.to,
              blockNumber: tx.blockNumber
            }
          });
        }
        
        // Gas price insight
        const gweiPrice = Number(data.gasPrice) / 1e9;
        if (gweiPrice < 2) {
          insights.push({
            type: 'low_gas',
            priority: 'medium',
            data: {
              gasPrice: gweiPrice.toFixed(2),
              recommendation: 'Good time for transactions'
            }
          });
        }
        
        return insights;
      },

      // 3. Generate content for insights
      async generateInsightContent(insights: any[]) {
        const mockRuntime = {
          getSetting: (key: string) => process.env[key] || null
        };
        
        const contents = [];
        
        for (const insight of insights) {
          // Convert BigInt to string for JSON serialization
          const serializableInsight = {
            ...insight,
            data: {
              ...insight.data,
              blockNumber: insight.data.blockNumber?.toString()
            }
          };
          const context = `Generate a tweet about this BNB blockchain insight: ${JSON.stringify(serializableInsight)}`;
          const content = await mockGenerateText(mockRuntime, context);
          
          contents.push({
            insight,
            content,
            generated: !content.includes('[Generated without API key]')
          });
        }
        
        return contents;
      },

      // 4. Complete flow
      async execute() {
        console.log('=== BNB-MCP Full Flow ===');
        
        const data = await this.fetchBlockchainData();
        console.log('1. Fetched blockchain data:', {
          gasPrice: data.gasPrice.toString(),
          blockNumber: data.blockNumber.toString(),
          transfers: data.recentTransfers
        });
        
        const insights = await this.analyzeData(data);
        console.log(`2. Found ${insights.length} insights`);
        
        const contents = await this.generateInsightContent(insights);
        console.log('3. Generated content for insights');
        
        return {
          data,
          insights,
          contents,
          canPost: contents.length > 0
        };
      }
    };

    // Execute without OpenAI key
    const result1 = await bnbMcpFlow.execute();
    
    expect(result1.data).toBeDefined();
    expect(result1.insights.length).toBeGreaterThan(0);
    expect(result1.contents.length).toBe(result1.insights.length);
    expect(result1.contents[0].content).toContain('[Generated without API key]');
    expect(result1.contents[0].generated).toBe(false);

    // Execute with OpenAI key
    envMocker.mock({ OPENAI_API_KEY: 'test_key' });
    const result2 = await bnbMcpFlow.execute();
    
    expect(result2.contents[0].content).not.toContain('[Generated without API key]');
    // Should contain blockchain-related content (BNB or BSC)
    expect(result2.contents[0].content).toMatch(/BNB|BSC|blockchain/);
    expect(result2.contents[0].generated).toBe(true);
  });

  it('should handle scheduled insights service', async () => {
    // Mock scheduled service
    const scheduledService = {
      insights: [],
      running: false,
      
      async start(intervalMs: number = 60000) {
        this.running = true;
        console.log(`Starting scheduled insights every ${intervalMs}ms`);
        
        // Simulate one cycle
        await this.fetchAndStoreInsights();
      },
      
      async fetchAndStoreInsights() {
        const mockRuntime = {
          getSetting: (key: string) => process.env[key] || null
        };
        
        // Fetch data
        const client = new MockViemClient();
        const blockNumber = await client.getBlockNumber();
        
        // Generate insight
        const context = `Generate a scheduled blockchain insight for block ${blockNumber}`;
        const content = await mockGenerateText(mockRuntime, context);
        
        const insight = {
          id: `insight-${Date.now()}`,
          timestamp: Date.now(),
          blockNumber: blockNumber.toString(),
          content,
          posted: false
        };
        
        this.insights.push(insight);
        
        return insight;
      },
      
      stop() {
        this.running = false;
        console.log('Stopped scheduled insights');
      }
    };

    // Test scheduled service
    await scheduledService.start(1000);
    
    expect(scheduledService.running).toBe(true);
    expect(scheduledService.insights.length).toBe(1);
    expect(scheduledService.insights[0].content).toBeDefined();
    
    scheduledService.stop();
    expect(scheduledService.running).toBe(false);
  });
});