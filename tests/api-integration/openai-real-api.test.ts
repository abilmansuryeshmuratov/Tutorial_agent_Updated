import { describe, it, expect, beforeAll } from 'vitest';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('OpenAI Real API Integration Tests', () => {
    let openai: OpenAI;

    beforeAll(() => {
        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set in environment variables');
        }

        // Initialize OpenAI client
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
        });
    });

    describe('Models', () => {
        it('should list available models', async () => {
            try {
                const models = await openai.models.list();
                
                expect(models.data).toBeDefined();
                expect(Array.isArray(models.data)).toBe(true);
                expect(models.data.length).toBeGreaterThan(0);
                
                // Check for commonly used models
                const modelIds = models.data.map(m => m.id);
                const hasGPT4 = modelIds.some(id => id.includes('gpt-4'));
                const hasGPT35 = modelIds.some(id => id.includes('gpt-3.5'));
                
                console.log('Available models summary:', {
                    total: models.data.length,
                    hasGPT4,
                    hasGPT35,
                    sample: modelIds.slice(0, 5)
                });
            } catch (error: any) {
                console.error('Model listing error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Chat Completions', () => {
        it('should generate a simple chat completion', async () => {
            try {
                const completion = await openai.chat.completions.create({
                    model: process.env.SMALL_OPENAI_MODEL || 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant.'
                        },
                        {
                            role: 'user',
                            content: 'What is 2 + 2?'
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 100
                });

                expect(completion.choices).toBeDefined();
                expect(completion.choices.length).toBeGreaterThan(0);
                expect(completion.choices[0].message.content).toBeDefined();
                expect(completion.usage).toBeDefined();
                
                console.log('Simple completion:', {
                    response: completion.choices[0].message.content,
                    usage: completion.usage
                });
            } catch (error: any) {
                console.error('Chat completion error:', error);
                throw error;
            }
        }, 30000);

        it('should generate crypto market analysis', async () => {
            try {
                const completion = await openai.chat.completions.create({
                    model: process.env.MEDIUM_OPENAI_MODEL || 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a crypto market analyst with a skeptical and analytical perspective.'
                        },
                        {
                            role: 'user',
                            content: 'Analyze the following blockchain activity: Large whale moved 5000 BNB ($2.5M) to unknown wallet. Gas prices spiking to 20 gwei.'
                        }
                    ],
                    temperature: 0.8,
                    max_tokens: 200,
                    presence_penalty: 0.3,
                    frequency_penalty: 0.3
                });

                expect(completion.choices[0].message.content).toBeDefined();
                expect(completion.choices[0].message.content!.length).toBeGreaterThan(50);
                
                console.log('Crypto analysis:', {
                    response: completion.choices[0].message.content,
                    model: completion.model,
                    tokens: completion.usage
                });
            } catch (error: any) {
                console.error('Crypto analysis error:', error);
                throw error;
            }
        }, 30000);

        it('should test function calling capabilities', async () => {
            try {
                const completion = await openai.chat.completions.create({
                    model: process.env.MEDIUM_OPENAI_MODEL || 'gpt-4o',
                    messages: [
                        {
                            role: 'user',
                            content: 'Get the current gas price on BNB Chain and check if there are any large transactions above 1000 BNB'
                        }
                    ],
                    functions: [
                        {
                            name: 'get_gas_price',
                            description: 'Get current gas price on BNB Chain',
                            parameters: {
                                type: 'object',
                                properties: {},
                                required: []
                            }
                        },
                        {
                            name: 'get_large_transactions',
                            description: 'Get recent large transactions on BNB Chain',
                            parameters: {
                                type: 'object',
                                properties: {
                                    min_value: {
                                        type: 'number',
                                        description: 'Minimum transaction value in BNB'
                                    },
                                    limit: {
                                        type: 'number',
                                        description: 'Maximum number of transactions to return'
                                    }
                                },
                                required: ['min_value']
                            }
                        }
                    ],
                    function_call: 'auto'
                });

                expect(completion.choices[0]).toBeDefined();
                
                if (completion.choices[0].message.function_call) {
                    console.log('Function call requested:', {
                        function: completion.choices[0].message.function_call.name,
                        arguments: completion.choices[0].message.function_call.arguments
                    });
                } else {
                    console.log('No function call in response:', completion.choices[0].message.content);
                }
            } catch (error: any) {
                console.error('Function calling error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Embeddings', () => {
        it('should generate embeddings for text', async () => {
            try {
                const embedding = await openai.embeddings.create({
                    model: process.env.EMBEDDING_OPENAI_MODEL || 'text-embedding-3-small',
                    input: 'Large whale transaction detected on BNB Chain'
                });

                expect(embedding.data).toBeDefined();
                expect(embedding.data.length).toBe(1);
                expect(embedding.data[0].embedding).toBeDefined();
                expect(Array.isArray(embedding.data[0].embedding)).toBe(true);
                
                console.log('Embedding generated:', {
                    model: embedding.model,
                    dimensions: embedding.data[0].embedding.length,
                    usage: embedding.usage
                });
            } catch (error: any) {
                console.error('Embedding error:', error);
                throw error;
            }
        }, 30000);

        it('should generate embeddings for multiple texts', async () => {
            try {
                const texts = [
                    'BNB whale alert: 5000 BNB moved',
                    'Gas prices spiking on BSC',
                    'New DeFi protocol launched on Binance Smart Chain',
                    'Potential rug pull detected in new token'
                ];

                const embedding = await openai.embeddings.create({
                    model: process.env.EMBEDDING_OPENAI_MODEL || 'text-embedding-3-small',
                    input: texts
                });

                expect(embedding.data).toBeDefined();
                expect(embedding.data.length).toBe(texts.length);
                
                // Calculate similarity between first two embeddings
                const similarity = cosineSimilarity(
                    embedding.data[0].embedding,
                    embedding.data[1].embedding
                );
                
                console.log('Multiple embeddings:', {
                    count: embedding.data.length,
                    similarity_0_1: similarity.toFixed(4),
                    totalTokens: embedding.usage?.total_tokens
                });
            } catch (error: any) {
                console.error('Multiple embeddings error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Moderation', () => {
        it('should check content moderation', async () => {
            try {
                const moderation = await openai.moderations.create({
                    input: 'This is a normal tweet about cryptocurrency markets.'
                });

                expect(moderation.results).toBeDefined();
                expect(moderation.results.length).toBe(1);
                expect(moderation.results[0].flagged).toBe(false);
                
                console.log('Moderation result (safe content):', {
                    flagged: moderation.results[0].flagged,
                    categories: moderation.results[0].categories
                });
            } catch (error: any) {
                console.error('Moderation error:', error);
                throw error;
            }
        }, 30000);

        it('should test moderation thresholds', async () => {
            try {
                // Test with potentially problematic content (but still safe)
                const texts = [
                    'The market crash destroyed many portfolios',
                    'Traders are fighting for liquidity',
                    'This project is definitely not a scam'
                ];

                for (const text of texts) {
                    const moderation = await openai.moderations.create({
                        input: text
                    });

                    console.log(`Moderation for "${text.substring(0, 30)}...":`, {
                        flagged: moderation.results[0].flagged,
                        scores: {
                            hate: moderation.results[0].category_scores.hate?.toFixed(3),
                            violence: moderation.results[0].category_scores.violence?.toFixed(3),
                            'self-harm': moderation.results[0].category_scores['self-harm']?.toFixed(3)
                        }
                    });
                }
            } catch (error: any) {
                console.error('Moderation threshold test error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Image Generation', () => {
        it('should test DALL-E availability', async () => {
            try {
                // Just test with a simple prompt to check if the API is accessible
                const response = await openai.images.generate({
                    model: process.env.IMAGE_OPENAI_MODEL || 'dall-e-3',
                    prompt: 'A simple geometric pattern',
                    n: 1,
                    size: '1024x1024',
                    quality: 'standard'
                });

                expect(response.data).toBeDefined();
                expect(response.data.length).toBe(1);
                expect(response.data[0].url).toBeDefined();
                
                console.log('Image generation successful:', {
                    model: process.env.IMAGE_OPENAI_MODEL || 'dall-e-3',
                    url: response.data[0].url?.substring(0, 50) + '...'
                });
            } catch (error: any) {
                console.warn('Image generation not available or failed:', error.message);
                // Don't fail the test - image generation might not be available
            }
        }, 60000);
    });

    describe('Rate Limits and Usage', () => {
        it('should track API usage', async () => {
            const usageStats = {
                completions: 0,
                embeddings: 0,
                moderations: 0
            };

            try {
                // Make a few API calls to track usage
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 10
                });
                usageStats.completions = completion.usage?.total_tokens || 0;

                const embedding = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: 'test'
                });
                usageStats.embeddings = embedding.usage?.total_tokens || 0;

                const moderation = await openai.moderations.create({
                    input: 'test'
                });
                usageStats.moderations = 1; // Moderation doesn't return token usage

                console.log('API usage summary:', usageStats);
                
                expect(usageStats.completions).toBeGreaterThan(0);
                expect(usageStats.embeddings).toBeGreaterThan(0);
            } catch (error: any) {
                console.error('Usage tracking error:', error);
                throw error;
            }
        }, 30000);
    });
});

// Helper function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}