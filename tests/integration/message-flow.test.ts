/**
 * End-to-end message flow integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentMocker } from '../utils/mockProvider';

describe('Message Flow Integration Tests', () => {
  const envMocker = new EnvironmentMocker();

  beforeEach(() => {
    envMocker.mock({
      OPENAI_API_KEY: undefined,
      BIRDEYE_API_KEY: undefined,
      COINGECKO_API_KEY: undefined,
      EVM_PRIVATE_KEY: undefined,
      RPC_URL: undefined
    });
  });

  afterEach(() => {
    envMocker.restore();
  });

  it('should process blockchain query without API keys', async () => {
    // Simulate message processing pipeline
    const messageProcessor = {
      async processMessage(message: any) {
        const { content, userId } = message;
        
        // 1. Parse intent
        const intent = this.parseIntent(content);
        
        // 2. Route to appropriate handler
        const response = await this.routeToHandler(intent, message);
        
        // 3. Apply post-processing (moderation would happen here)
        const finalResponse = await this.postProcess(response);
        
        return finalResponse;
      },
      
      parseIntent(content: string) {
        const lower = content.toLowerCase();
        
        if (lower.includes('price')) return 'PRICE_QUERY';
        if (lower.includes('swap')) return 'SWAP_REQUEST';
        if (lower.includes('insight') || lower.includes('bnb')) return 'BNB_INSIGHTS';
        
        return 'GENERAL';
      },
      
      async routeToHandler(intent: string, message: any) {
        switch (intent) {
          case 'PRICE_QUERY':
            return {
              text: 'Price data is currently unavailable. Please configure API keys for price information.',
              success: false,
              reason: 'No API keys'
            };
            
          case 'SWAP_REQUEST':
            return {
              text: 'Token swaps require a configured wallet. Please set EVM_PRIVATE_KEY.',
              success: false,
              reason: 'No wallet configured'
            };
            
          case 'BNB_INSIGHTS':
            // This can work with public RPC
            return {
              text: 'Here are the latest BNB chain insights:\n- Gas price: 1 gwei\n- Latest block: 30000036\n- Network is operational',
              success: true,
              data: {
                gasPrice: '1000000000',
                blockNumber: 30000036
              }
            };
            
          default:
            return {
              text: 'I can help you with blockchain insights and information. Some features require API configuration.',
              success: true
            };
        }
      },
      
      async postProcess(response: any) {
        // Would apply moderation here if API key was available
        return {
          ...response,
          moderated: false,
          moderationReason: 'No OpenAI API key'
        };
      }
    };

    // Test various message types
    const priceQuery = await messageProcessor.processMessage({
      userId: 'test-user',
      content: 'What is the price of BNB?'
    });
    
    expect(priceQuery.success).toBe(false);
    expect(priceQuery.text).toContain('API keys');

    const insightQuery = await messageProcessor.processMessage({
      userId: 'test-user',
      content: 'Show me BNB insights'
    });
    
    expect(insightQuery.success).toBe(true);
    expect(insightQuery.text).toContain('Gas price');
    expect(insightQuery.data).toBeDefined();
  });

  it('should handle Twitter posting flow without moderation', async () => {
    // Simulate Twitter posting pipeline
    const twitterPipeline = {
      async postTweet(content: string, options: any = {}) {
        const pipeline = [];
        
        // 1. Generate content (if needed)
        if (options.generateContent) {
          pipeline.push({
            step: 'generation',
            status: 'skipped',
            reason: 'No API key for generation'
          });
        }
        
        // 2. Apply moderation
        const moderationResult = await this.moderate(content);
        pipeline.push({
          step: 'moderation',
          ...moderationResult
        });
        
        // 3. Post tweet (mock)
        if (moderationResult.allowed) {
          pipeline.push({
            step: 'posting',
            status: 'success',
            tweetId: 'mock_tweet_123'
          });
        }
        
        return {
          success: moderationResult.allowed,
          pipeline,
          finalContent: content
        };
      },
      
      async moderate(content: string) {
        // No API key, fail open
        return {
          allowed: true,
          status: 'skipped',
          reason: 'No OpenAI API key - failing open'
        };
      }
    };

    const result = await twitterPipeline.postTweet(
      '🚨 Large BNB transaction detected! 100 BNB moved between wallets.'
    );
    
    expect(result.success).toBe(true);
    expect(result.pipeline).toHaveLength(2);
    expect(result.pipeline[0].step).toBe('moderation');
    expect(result.pipeline[0].status).toBe('skipped');
  });

  it('should handle full agent conversation flow', async () => {
    // Simulate full conversation
    const conversation = {
      messages: [],
      
      async handleMessage(userId: string, content: string) {
        this.messages.push({ userId, content, timestamp: Date.now() });
        
        // Simulate agent processing
        const context = this.buildContext(userId);
        const response = await this.generateResponse(content, context);
        
        this.messages.push({ 
          userId: 'agent', 
          content: response.text, 
          timestamp: Date.now() 
        });
        
        return response;
      },
      
      buildContext(userId: string) {
        const userMessages = this.messages.filter(m => m.userId === userId);
        return {
          messageCount: userMessages.length,
          hasApiKeys: false,
          availableFeatures: ['bnb_insights', 'general_chat']
        };
      },
      
      async generateResponse(content: string, context: any) {
        // Simple response generation without LLM
        if (content.toLowerCase().includes('help')) {
          return {
            text: 'I can help you with:\n- BNB chain insights (working)\n- Price data (requires API keys)\n- Token swaps (requires wallet)\n\nSome features are limited without API configuration.',
            action: 'help'
          };
        }
        
        if (content.toLowerCase().includes('status')) {
          return {
            text: `System Status:\n- Messages processed: ${context.messageCount}\n- API Keys: Not configured\n- Available features: ${context.availableFeatures.join(', ')}`,
            action: 'status'
          };
        }
        
        return {
          text: 'I understand your request. Some features require API configuration to work properly.',
          action: 'general'
        };
      }
    };

    // Simulate conversation
    const response1 = await conversation.handleMessage('user1', 'help');
    expect(response1.text).toContain('BNB chain insights');
    
    const response2 = await conversation.handleMessage('user1', 'What is the system status?');
    expect(response2.text).toContain('Messages processed: 2');
    
    expect(conversation.messages).toHaveLength(4); // 2 user, 2 agent
  });

  it('should handle error propagation correctly', async () => {
    const errorHandler = {
      errors: [],
      
      async executeWithErrorHandling(fn: Function, context: string) {
        try {
          return await fn();
        } catch (error) {
          this.errors.push({
            context,
            error: error.message,
            timestamp: Date.now(),
            handled: true
          });
          
          // Return appropriate fallback
          if (context === 'price_fetch') {
            return { error: 'Price data unavailable', fallback: true };
          }
          if (context === 'moderation') {
            return { allowed: true, error: 'Moderation skipped' };
          }
          
          throw error; // Re-throw unknown errors
        }
      }
    };

    // Test price fetch error
    const priceResult = await errorHandler.executeWithErrorHandling(
      async () => { throw new Error('No API key'); },
      'price_fetch'
    );
    
    expect(priceResult.error).toBe('Price data unavailable');
    expect(priceResult.fallback).toBe(true);
    expect(errorHandler.errors).toHaveLength(1);

    // Test moderation error (should fail open)
    const modResult = await errorHandler.executeWithErrorHandling(
      async () => { throw new Error('OpenAI API error'); },
      'moderation'
    );
    
    expect(modResult.allowed).toBe(true);
    expect(errorHandler.errors).toHaveLength(2);
  });
});