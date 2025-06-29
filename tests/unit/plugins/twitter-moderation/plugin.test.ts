/**
 * Unit tests for Twitter OpenAI Moderation Plugin
 * Tests content moderation without API keys
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentMocker } from '../../../utils/mockProvider';
import axios from 'axios';
import { mockOpenAIResponses } from './mocks/openai.mock';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock elizaLogger
vi.mock('@elizaos/core', () => ({
  elizaLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Twitter OpenAI Moderation Plugin Tests', () => {
  const envMocker = new EnvironmentMocker();

  beforeEach(() => {
    // Clear environment variables
    envMocker.mock({
      OPENAI_API_KEY: undefined,
      TWITTER_MODERATION_ENABLED: 'true',
      TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
      TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5',
      TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
      TWITTER_MODERATION_ONLY_REPLIES: 'true',
      TWITTER_DRY_RUN: 'false'
    });
    
    // Setup axios mock responses
    mockedAxios.post = vi.fn().mockImplementation((url: string, data: any, config: any) => {
      const apiKey = config?.headers?.Authorization?.replace('Bearer ', '');
      
      if (!apiKey || apiKey === 'invalid_key') {
        return Promise.reject(new Error('Invalid API key'));
      }
      
      if (apiKey === 'rate_limited_key') {
        return Promise.reject(new Error('Rate limit exceeded'));
      }
      
      const content = data.input.toLowerCase();
      
      if (content.includes('hate') || content.includes('violence')) {
        return Promise.resolve({ data: mockOpenAIResponses.flaggedContent });
      }
      
      if (content.includes('borderline') || content.includes('maybe')) {
        return Promise.resolve({ data: mockOpenAIResponses.borderlineContent });
      }
      
      return Promise.resolve({ data: mockOpenAIResponses.cleanContent });
    });
  });

  afterEach(() => {
    envMocker.restore();
    vi.clearAllMocks();
  });

  describe('Plugin Functionality', () => {
    it('should allow content through without API key (fail-open)', async () => {
      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'This is a friendly and helpful message!',
        { inReplyToTweetId: 'reply123' }
      );
      
      expect(result).toBe('This is a friendly and helpful message!');
    });

    it('should allow clean content with valid API key', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'This is a friendly and helpful message!',
        { inReplyToTweetId: 'reply123' }
      );
      
      expect(result).toBe('This is a friendly and helpful message!');
    });

    it('should block content with hate speech', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'This message contains hate speech',
        { inReplyToTweetId: 'reply123' }
      );
      
      expect(result).toBeNull();
    });

    it('should respect custom thresholds', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key',
        TWITTER_MODERATION_THRESHOLD_HATE: '0.3',
        TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.3'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.3',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.3'
          };
          return settings[key] || null;
        }
      };
      
      // Borderline content that would pass with 0.5 threshold but fail with 0.3
      const result = await beforeSend(
        mockRuntime as any,
        'This is borderline content maybe inappropriate',
        { inReplyToTweetId: 'reply123' }
      );
      
      expect(result).toBeNull();
    });

    it('should only moderate replies when TWITTER_MODERATION_ONLY_REPLIES is true', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key',
        TWITTER_MODERATION_ONLY_REPLIES: 'true'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      // Regular tweet (not a reply) with flaggable content
      const result = await beforeSend(
        mockRuntime as any,
        'This message contains hate speech',
        {} // No inReplyToTweetId
      );
      
      // Should allow it because it's not a reply
      expect(result).toBe('This message contains hate speech');
    });

    it('should moderate all content when TWITTER_MODERATION_ONLY_REPLIES is false', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key',
        TWITTER_MODERATION_ONLY_REPLIES: 'false'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'false',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      // Regular tweet with flaggable content
      const result = await beforeSend(
        mockRuntime as any,
        'This message contains hate speech',
        {} // No inReplyToTweetId
      );
      
      // Should block it
      expect(result).toBeNull();
    });
  });

  describe('API Error Handling', () => {
    it('should fail open when API is unavailable', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'rate_limited_key'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'rate_limited_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'Any content here',
        { inReplyToTweetId: 'reply123' }
      );
      
      // Should allow content when API fails (fail-open)
      expect(result).toBe('Any content here');
    });

    it('should handle missing API key gracefully', async () => {
      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'This message contains hate speech',
        { inReplyToTweetId: 'reply123' }
      );
      
      // Should allow content when no API key (fail-open)
      expect(result).toBe('This message contains hate speech');
    });

    it('should handle invalid API key', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'invalid_key'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'invalid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'Any content',
        { inReplyToTweetId: 'reply123' }
      );
      
      // Should fail open
      expect(result).toBe('Any content');
    });
  });

  describe('Configuration Validation', () => {
    it('should handle dry run mode', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key',
        TWITTER_DRY_RUN: 'true'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_DRY_RUN: 'true'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'This message contains hate speech',
        { inReplyToTweetId: 'reply123' }
      );
      
      // Should skip moderation in dry run mode
      expect(result).toBe('This message contains hate speech');
    });

    it('should respect disabled moderation', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key',
        TWITTER_MODERATION_ENABLED: 'false'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'false',
            TWITTER_MODERATION_ONLY_REPLIES: 'true'
          };
          return settings[key] || null;
        }
      };
      
      const result = await beforeSend(
        mockRuntime as any,
        'This message contains hate speech',
        { inReplyToTweetId: 'reply123' }
      );
      
      // Should skip moderation when disabled
      expect(result).toBe('This message contains hate speech');
    });

    it('should parse block reasons correctly', async () => {
      envMocker.mock({
        OPENAI_API_KEY: 'valid_key',
        TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence,harassment'
      });

      const { beforeSend } = await import('@elizaos/client-twitter/src/plugins/OpenAIModerationPlugin');
      
      const mockRuntime = {
        getSetting: (key: string) => {
          const settings: Record<string, string> = {
            OPENAI_API_KEY: 'valid_key',
            TWITTER_MODERATION_ENABLED: 'true',
            TWITTER_MODERATION_ONLY_REPLIES: 'true',
            TWITTER_MODERATION_BLOCK_REASONS: 'hate,violence,harassment',
            TWITTER_MODERATION_THRESHOLD_HATE: '0.5',
            TWITTER_MODERATION_THRESHOLD_VIOLENCE: '0.5',
            TWITTER_MODERATION_THRESHOLD_HARASSMENT: '0.5'
          };
          return settings[key] || null;
        }
      };
      
      // Set up axios to return a response with harassment flagged
      mockedAxios.post = vi.fn().mockResolvedValue({
        data: {
          id: 'modr-test',
          model: 'text-moderation-007',
          results: [{
            categories: {
              hate: false,
              violence: false,
              harassment: true
            },
            category_scores: {
              hate: 0.1,
              violence: 0.1,
              harassment: 0.6
            },
            flagged: true
          }]
        }
      });
      
      const result = await beforeSend(
        mockRuntime as any,
        'Test content with harassment',
        { inReplyToTweetId: 'reply123' }
      );
      
      // Should block due to harassment
      expect(result).toBeNull();
    });
  });
});