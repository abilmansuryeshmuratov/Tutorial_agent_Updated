/**
 * Simple Pipeline Test - Demonstrates the core functionality without complex dependencies
 */

import { describe, it, expect } from 'vitest';
import { mockGenerateText, MockOpenAIClient } from '../unit/core/mocks/openai-generation.mock';
import { MockViemClient } from '../unit/plugins/bnb-mcp/mocks/rpc.mock';

describe('Simple Pipeline Test', () => {
  it('should demonstrate content generation without OpenAI key', async () => {
    // Mock runtime without API key
    const mockRuntime = {
      getSetting: (key: string) => null
    };

    // Test various content generation scenarios
    const scenarios = [
      {
        context: 'Create a tweet about BNB network activity',
        expectedContent: '[Generated without API key]'
      },
      {
        context: 'Generate insight about gas prices',
        expectedContent: '[Generated without API key]'
      }
    ];

    for (const scenario of scenarios) {
      const content = await mockGenerateText(mockRuntime, scenario.context);
      expect(content).toContain(scenario.expectedContent);
    }
  });

  it('should demonstrate content generation with OpenAI key', async () => {
    // Mock runtime with API key
    const mockRuntime = {
      getSetting: (key: string) => key === 'OPENAI_API_KEY' ? 'test_key' : null
    };

    // Generate content
    const content = await mockGenerateText(mockRuntime, 'Create a tweet about BNB network: gas 1 gwei, block 30000000');
    
    // Should have realistic content
    expect(content).not.toContain('[Generated without API key]');
    expect(content.length).toBeGreaterThan(20);
    // Content should be about blockchain (may mention BNB, BSC, or tokens)
    expect(content.toLowerCase()).toMatch(/bnb|bsc|blockchain|transaction|token/);
  });

  it('should demonstrate blockchain data fetching', async () => {
    // Use mock viem client
    const client = new MockViemClient();
    
    // Fetch data
    const gasPrice = await client.getGasPrice();
    const blockNumber = await client.getBlockNumber();
    const balance = await client.getBalance({ address: '0x123' });
    
    // Verify data
    expect(gasPrice).toBeDefined();
    expect(gasPrice).toBe(1000000000n); // 1 gwei
    expect(blockNumber).toBeDefined();
    expect(blockNumber).toBeGreaterThan(29000000n); // Just check it's a reasonable block number
    expect(balance).toBeDefined();
  });

  it('should demonstrate content moderation', async () => {
    // Test without API key
    const clientNoKey = new MockOpenAIClient();
    await expect(clientNoKey.moderations.create({ input: 'test' }))
      .rejects.toThrow('OpenAI API key not configured');

    // Test with API key
    const clientWithKey = new MockOpenAIClient('test_key');
    
    // Clean content
    const cleanResult = await clientWithKey.moderations.create({ 
      input: 'This is a friendly message' 
    });
    expect(cleanResult.results[0].flagged).toBe(false);
    
    // Flagged content
    const flaggedResult = await clientWithKey.moderations.create({ 
      input: 'This contains hate speech and violence' 
    });
    expect(flaggedResult.results[0].flagged).toBe(true);
  });

  it('should demonstrate complete flow', async () => {
    console.log('\n=== COMPLETE FLOW DEMO ===\n');
    
    // 1. User input
    const userInput = "Show me BNB network insights";
    console.log(`1. User: "${userInput}"`);
    
    // 2. Fetch blockchain data (always works)
    const client = new MockViemClient();
    const gasPrice = await client.getGasPrice();
    console.log(`2. Blockchain data: Gas ${Number(gasPrice) / 1e9} gwei`);
    
    // 3. Generate content (no API key)
    const mockRuntime = { getSetting: () => null };
    const content = await mockGenerateText(mockRuntime, 
      `Create insight about gas price ${Number(gasPrice) / 1e9} gwei`
    );
    console.log(`3. Generated: "${content}"`);
    
    // 4. Output
    console.log(`4. Final response: "${content}"`);
    console.log('\n=== END DEMO ===\n');
    
    expect(content).toBeDefined();
    expect(content).toContain('[Generated without API key]');
  });
});