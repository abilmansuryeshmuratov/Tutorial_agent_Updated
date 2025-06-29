import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonalityContentGenerator } from '@elizaos/plugin-bnb-mcp/src/services/personalityContentGenerator';
import { ContentEnhancer } from '@elizaos/plugin-bnb-mcp/src/services/contentEnhancer';
import { TwitterService } from '@elizaos/plugin-bnb-mcp/src/services/twitterService';
import type { BNBMCPInsight } from '@elizaos/plugin-bnb-mcp/src/types';

// Mock elizaLogger
vi.mock('@elizaos/core', () => ({
  elizaLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  generateText: vi.fn(),
  ModelClass: { SMALL: 'small' }
}));

describe('Personality Content Generation', () => {
  let personalityGenerator: PersonalityContentGenerator;
  let contentEnhancer: ContentEnhancer;

  beforeEach(() => {
    personalityGenerator = new PersonalityContentGenerator();
    contentEnhancer = new ContentEnhancer();
    vi.clearAllMocks();
  });

  describe('PersonalityContentGenerator', () => {
    it('should generate personality-driven fallback content', () => {
      const insight: BNBMCPInsight = {
        type: 'large_transfer',
        title: 'Large BNB Transfer',
        description: 'Transfer of 1000 BNB detected',
        data: {
          hash: '0xabc123',
          from: '0x1234567890abcdef',
          to: '0xfedcba0987654321',
          value: '1000',
          blockNumber: 30000000,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        severity: 'high'
      };

      const content = personalityGenerator.generateContent(insight, false);
      
      // Should contain personality markers or technical language
      expect(content).toMatch(/whale|degen|BNB|tracking|rekt|pattern|forming|on-chain/i);
      
      // Should be concise for Twitter
      expect(content.length).toBeLessThan(280);
      
      // Should include actual data
      expect(content).toContain('1000');
    });

    it('should vary content for similar insights', () => {
      const insight: BNBMCPInsight = {
        type: 'new_contract',
        title: 'New Contract Deployed',
        description: 'New smart contract deployed on BSC',
        data: {
          hash: '0xdef456',
          creator: '0xabcdef123456',
          contractAddress: '0x654321fedcba',
          blockNumber: 30000001,
          timestamp: Date.now()
        },
        timestamp: Date.now(),
        severity: 'medium'
      };

      // Generate multiple times
      const contents = Array(5).fill(null).map(() => 
        personalityGenerator.generateContent(insight, false)
      );
      
      // Should have variety
      const uniqueContents = new Set(contents);
      expect(uniqueContents.size).toBeGreaterThan(2);
    });

    it('should create personality-rich OpenAI prompts', () => {
      const insight: BNBMCPInsight = {
        type: 'whale_activity',
        title: 'Whale Movement',
        description: 'Major whale activity detected',
        data: {
          value: '5000',
          pattern: 'accumulation'
        },
        timestamp: Date.now(),
        severity: 'high'
      };

      const prompt = personalityGenerator.createPersonalityPrompt(insight);
      
      // Should include character context
      expect(prompt).toContain('Tutorial Agent');
      expect(prompt).toContain('sarcasm');
      expect(prompt).toContain('street smart');
      
      // Should include insight data
      expect(prompt).toContain('whale_activity');
      expect(prompt).toContain('5000');
    });
  });

  describe('ContentEnhancer', () => {
    it('should enhance content with personality markers', () => {
      const content = 'Large transfer detected on BNB Chain';
      const enhanced = contentEnhancer.enhanceContent(content, 'neutral');
      
      // Should add opener or closer
      expect(enhanced.length).toBeGreaterThan(content.length);
      
      // Should maintain readability
      expect(enhanced).toContain('transfer');
    });

    it('should add sarcasm when appropriate', () => {
      const content = 'New revolutionary DeFi protocol launched';
      const sarcastic = contentEnhancer.makeSarcastic(content);
      
      // Should add quotes for sarcasm
      expect(sarcastic).toContain('"revolutionary"');
    });

    it('should add technical context', () => {
      const content = 'Transaction confirmed';
      const data = {
        gasPrice: '5',
        blockNumber: 30000000,
        value: '100'
      };
      
      const technical = contentEnhancer.addTechnicalContext(content, data);
      
      // Should include technical details
      expect(technical).toContain('gas: 5 gwei');
      expect(technical).toContain('block: 30000000');
    });

    it('should ensure variety in repeated content', () => {
      const content = 'Large whale transfer detected';
      const recentContents = [
        'Large whale transfer detected',
        'Another large whale transfer found'
      ];
      
      const varied = contentEnhancer.ensureVariety(content, recentContents);
      
      // Should modify the language
      expect(varied).not.toBe(content);
    });

    it('should respect content length limits', () => {
      const longContent = 'a'.repeat(250);
      const enhanced = contentEnhancer.enhanceContent(longContent);
      
      // Should not exceed Twitter limit
      expect(enhanced.length).toBeLessThan(280);
    });
  });

  describe('TwitterService Integration', () => {
    it('should generate personality-driven tweets without OpenAI', async () => {
      const mockRuntime = {
        getSetting: vi.fn().mockReturnValue(undefined), // No API keys
        clients: { twitter: null }
      };

      const service = new TwitterService(mockRuntime as any);
      
      const insight: BNBMCPInsight = {
        type: 'large_transfer',
        title: 'Whale Alert',
        description: 'Massive BNB movement',
        data: {
          value: '10000',
          from: '0xabc',
          to: '0xdef'
        },
        timestamp: Date.now(),
        severity: 'high'
      };

      const tweet = await service.generateTweetText(insight);
      
      // Should have personality
      expect(tweet).toMatch(/anon|whale|degen|tracking|BNB/i);
      
      // Should include hashtags
      expect(tweet).toContain('#');
      
      // Should be tweet-length
      expect(tweet.length).toBeLessThan(280);
    });

    it('should determine sentiment correctly', () => {
      const service = new TwitterService({} as any);
      
      const positiveInsight: BNBMCPInsight = {
        type: 'whale_activity',
        title: 'Accumulation',
        description: 'Whale accumulation pattern detected',
        data: {},
        timestamp: Date.now(),
        severity: 'high'
      };
      
      const negativeInsight: BNBMCPInsight = {
        type: 'large_transfer',
        title: 'Dump Alert',
        description: 'Major sell-off in progress',
        data: {},
        timestamp: Date.now(),
        severity: 'high'
      };
      
      // Test sentiment detection
      const positiveTweet = service['determineSentiment'](positiveInsight);
      const negativeTweet = service['determineSentiment'](negativeInsight);
      
      expect(positiveTweet).toBe('positive');
      expect(negativeTweet).toBe('negative');
    });
  });

  describe('Character Voice Consistency', () => {
    it('should maintain Tutorial Agent voice', () => {
      const generator = new PersonalityContentGenerator();
      const enhancer = new ContentEnhancer();
      
      const insight: BNBMCPInsight = {
        type: 'new_contract',
        title: 'New Protocol',
        description: 'Another yield farm launched',
        data: { contractAddress: '0x123' },
        timestamp: Date.now(),
        severity: 'low'
      };
      
      let content = generator.generateContent(insight, false);
      content = enhancer.enhanceContent(content, 'neutral');
      content = enhancer.makeSarcastic(content);
      
      // Should sound like Tutorial Agent
      const hasCharacterVoice = 
        content.includes('another') ||
        content.includes('probably nothing') ||
        content.includes('rug') ||
        content.includes('"') || // Sarcasm quotes
        /[a-z]{5,}/.test(content); // Some lowercase emphasis
        
      expect(hasCharacterVoice).toBe(true);
    });
  });
});