import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TwitterSearchClient } from '@elizaos/client-twitter/src/search';
import { IAgentRuntime, ModelClass, elizaLogger, generateText } from '@elizaos/core';
import { SearchMode } from 'agent-twitter-client';
import { 
    mockTweets, 
    mockApiResponses, 
    createMockTweet,
    createMockApiResponse,
    mockTimeline 
} from './mocks/twitter-api-v2.mock';

// Mock dependencies
vi.mock('@elizaos/core', async () => {
    const actual = await vi.importActual('@elizaos/core');
    return {
        ...actual,
        elizaLogger: {
            log: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        },
        generateText: vi.fn().mockResolvedValue('Generated response based on context'),
        generateMessageResponse: vi.fn(),
        composeContext: vi.fn(),
        stringToUuid: vi.fn(str => `uuid-${str}`),
        getEmbeddingZeroVector: vi.fn(() => Array(1536).fill(0))
    };
});

describe('Twitter Search Validation Tests', () => {
    let searchClient: TwitterSearchClient;
    let mockClient: any;
    let runtime: IAgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Mock Twitter client
        mockClient = {
            profile: {
                id: '123456789',
                username: 'testbot',
                screenName: 'Test Bot'
            },
            twitterConfig: {
                TWITTER_USERNAME: 'testbot',
                TWITTER_DRY_RUN: false
            },
            twitterClient: {
                getTweet: vi.fn(),
                sendTweet: vi.fn()
            },
            fetchSearchTweets: vi.fn(),
            fetchHomeTimeline: vi.fn(),
            cacheTimeline: vi.fn(),
            saveRequestMessage: vi.fn(),
            requestQueue: {
                add: vi.fn(fn => fn())
            }
        };

        // Mock runtime
        runtime = {
            agentId: 'agent-123',
            character: {
                name: 'TestBot',
                bio: 'A test bot for Twitter search',
                topics: ['artificial intelligence', 'machine learning', 'technology'],
                templates: {}
            },
            messageManager: {
                createMemory: vi.fn(),
                getMemoryById: vi.fn().mockResolvedValue(null)
            },
            ensureConnection: vi.fn(),
            ensureUserExists: vi.fn(),
            ensureRoomExists: vi.fn(),
            ensureParticipantInRoom: vi.fn(),
            composeState: vi.fn().mockResolvedValue({
                userId: 'agent-123',
                roomId: 'room-123',
                agentId: 'agent-123',
                content: { text: '', action: '' }
            }),
            updateRecentMessageState: vi.fn(state => state),
            processActions: vi.fn(),
            evaluate: vi.fn(),
            cacheManager: {
                get: vi.fn(),
                set: vi.fn()
            },
            getService: vi.fn().mockReturnValue({
                describeImage: vi.fn().mockResolvedValue('An image description')
            })
        } as any;

        searchClient = new TwitterSearchClient(mockClient, runtime);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe('Search Initialization and Configuration', () => {
        it('should initialize with correct configuration', () => {
            expect(searchClient).toBeDefined();
            expect(searchClient['twitterUsername']).toBe('testbot');
        });

        it('should start search loop with random intervals', async () => {
            const startSpy = vi.spyOn(searchClient, 'start');
            await searchClient.start();
            
            expect(startSpy).toHaveBeenCalled();
            // Verify that a timer was set
            expect(vi.getTimerCount()).toBeGreaterThan(0);
        });
    });

    describe('Search Query Execution', () => {
        it('should search using character topics', async () => {
            const searchResults = [
                createMockTweet({ id: '1', text: 'AI breakthrough announced today!' }),
                createMockTweet({ id: '2', text: 'Machine learning models getting smarter' })
            ];

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: searchResults
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce(mockTimeline);

            vi.mocked(generateText).mockResolvedValueOnce('1'); // Select first tweet
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Exciting developments!',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            // Should use one of the topics
            expect(mockClient.fetchSearchTweets).toHaveBeenCalledWith(
                expect.stringMatching(/artificial intelligence|machine learning|technology/),
                20,
                SearchMode.Top
            );
        });

        it('should handle empty search results', async () => {
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: []
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            await searchClient['engageWithSearchTerms']();

            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('No valid tweets found'),
                expect.any(String)
            );
        });

        it('should validate search API response structure', async () => {
            const apiResponse = mockApiResponses.searchTweets.success;
            const tweets = apiResponse.data.map((t: any) => createMockTweet(t));

            mockClient.fetchSearchTweets.mockResolvedValueOnce({ tweets });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce(tweets[0].id);

            await searchClient['engageWithSearchTerms']();

            expect(tweets).toHaveLength(3);
            expect(tweets[0]).toHaveProperty('id');
            expect(tweets[0]).toHaveProperty('text');
        });
    });

    describe('Tweet Selection and Filtering', () => {
        it('should select most interesting tweet from search results', async () => {
            const tweets = [
                createMockTweet({ 
                    id: '1', 
                    text: 'Just posted a cat picture #cute',
                    hashtags: ['#cute']
                }),
                createMockTweet({ 
                    id: '2', 
                    text: 'Fascinating insights on AI safety and alignment'
                }),
                createMockTweet({ 
                    id: '3', 
                    text: 'RT: Check out this link spam.com'
                })
            ];

            mockClient.fetchSearchTweets.mockResolvedValueOnce({ tweets });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('2'); // Select the AI tweet
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Great insights on AI safety!',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(vi.mocked(generateText)).toHaveBeenCalledWith({
                runtime,
                context: expect.stringContaining('Which tweet is the most interesting'),
                modelClass: ModelClass.SMALL
            });
        });

        it('should filter out bot\'s own tweets from threads', async () => {
            const tweetWithBotInThread = createMockTweet({
                id: '4',
                text: 'Interesting discussion',
                thread: [
                    createMockTweet({ id: '4a', username: 'user1' }),
                    createMockTweet({ id: '4b', username: 'testbot' }), // Bot's tweet
                    createMockTweet({ id: '4c', username: 'user2' })
                ]
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithBotInThread]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('5'); // Try to select filtered tweet

            await searchClient['engageWithSearchTerms']();

            // Tweet should be filtered out, so no response generated
            expect(elizaLogger.warn).toHaveBeenCalledWith(
                'No matching tweet found for the selected ID'
            );
        });

        it('should skip tweets from bot itself', async () => {
            const ownTweet = createMockTweet({
                id: '5',
                text: 'My own tweet',
                username: 'testbot',
                userId: '123456789'
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [ownTweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('5');

            await searchClient['engageWithSearchTerms']();

            expect(elizaLogger.log).toHaveBeenCalledWith(
                'Skipping tweet from bot itself'
            );
        });
    });

    describe('Response Generation with Context', () => {
        it('should generate response with timeline context', async () => {
            const searchTweet = createMockTweet({
                id: '6',
                text: 'What are your thoughts on AGI?'
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [searchTweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce(mockTimeline);

            vi.mocked(generateText).mockResolvedValueOnce('6');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'AGI development requires careful consideration.',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(runtime.composeState).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    timeline: expect.stringContaining("TestBot's Home Timeline")
                })
            );
        });

        it('should handle retweets with original context', async () => {
            const retweet = createMockTweet({
                id: '7',
                text: 'RT @original: Great article on AI',
                isRetweet: true
            });

            const originalTweet = createMockTweet({
                id: '7a',
                text: 'Great article on AI: link.com',
                username: 'original'
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [retweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);
            mockClient.twitterClient.getTweet.mockResolvedValueOnce(originalTweet);

            vi.mocked(generateText).mockResolvedValueOnce('7');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Thanks for sharing this article!',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(mockClient.requestQueue.add).toHaveBeenCalled();
            expect(runtime.composeState).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    tweetContext: expect.stringContaining('Retweeting @original')
                })
            );
        });

        it('should process images in search results', async () => {
            const tweetWithImage = createMockTweet({
                id: '8',
                text: 'Check out this AI visualization',
                photos: [
                    { url: 'https://example.com/ai-viz.jpg', alt_text: 'AI visualization' }
                ]
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithImage]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('8');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Fascinating visualization!',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(runtime.getService).toHaveBeenCalledWith('IMAGE_DESCRIPTION');
            expect(runtime.composeState).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    tweetContext: expect.stringContaining('Images in Post (Described)')
                })
            );
        });
    });

    describe('Reply Handling and Validation', () => {
        it('should include reply context in response', async () => {
            const tweetWithReplies = createMockTweet({
                id: '9',
                text: 'What do you think about this?',
                thread: [
                    createMockTweet({ 
                        id: '9a', 
                        text: 'I think it\'s interesting',
                        username: 'user1'
                    }),
                    createMockTweet({ 
                        id: '9b', 
                        text: 'Agreed, very compelling',
                        username: 'user2'
                    })
                ]
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithReplies]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('9');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'I share similar thoughts!',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(runtime.composeState).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    tweetContext: expect.stringContaining('Replies to original post')
                })
            );
        });

        it('should validate response length constraints', async () => {
            const tweet = createMockTweet({
                id: '10',
                text: 'Short question?'
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('10');
            
            // Long response that should be constrained
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'This is a very long response that exceeds the 20 word limit specified in the template',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            // Template specifies max 20 words
            expect(vi.mocked(composeContext)).toHaveBeenCalledWith({
                state: expect.any(Object),
                template: expect.stringContaining('CANNOT be longer than 20 words')
            });
        });
    });

    describe('Memory and State Management', () => {
        it('should save tweet to memory after response', async () => {
            const tweet = createMockTweet({
                id: '11',
                text: 'Memory test tweet'
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('11');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Response saved to memory',
                action: null
            });

            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                createMockApiResponse(mockApiResponses.createTweet.success)
            );

            await searchClient['engageWithSearchTerms']();

            expect(runtime.messageManager.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        text: tweet.text,
                        url: tweet.permanentUrl,
                        source: 'twitter'
                    })
                }),
                false
            );
        });

        it('should track responded tweets', async () => {
            const tweet = createMockTweet({ id: '12' });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('12');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Tracked response',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(searchClient['respondedTweets'].has('12')).toBe(true);
        });

        it('should cache response generation context', async () => {
            const tweet = createMockTweet({ id: '13' });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('13');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Cached response',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(runtime.cacheManager.set).toHaveBeenCalledWith(
                `twitter/tweet_generation_${tweet.id}.txt`,
                expect.stringContaining('Context:')
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle search API errors', async () => {
            mockClient.fetchSearchTweets.mockRejectedValueOnce(
                new Error('Search API error')
            );

            await searchClient['engageWithSearchTerms']();

            expect(console.error).toHaveBeenCalledWith(
                'Error engaging with search terms:',
                expect.any(Error)
            );
        });

        it('should handle tweet sending failures', async () => {
            const tweet = createMockTweet({ id: '14' });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('14');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Failed response',
                action: null
            });

            mockClient.twitterClient.sendTweet.mockRejectedValueOnce(
                new Error('Send failed')
            );

            await searchClient['engageWithSearchTerms']();

            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Error sending response post'),
                expect.any(Error)
            );
        });

        it('should handle missing response text', async () => {
            const tweet = createMockTweet({ id: '15' });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('15');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: '',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(elizaLogger.warn).toHaveBeenCalledWith(
                'Returning: No response text found'
            );
        });
    });

    describe('URL and Link Handling', () => {
        it('should include URLs in tweet context', async () => {
            const tweetWithUrls = createMockTweet({
                id: '16',
                text: 'Check out this article',
                urls: ['https://example.com/article', 'https://example.com/resource']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithUrls]
            });
            mockClient.fetchHomeTimeline.mockResolvedValueOnce([]);

            vi.mocked(generateText).mockResolvedValueOnce('16');
            vi.mocked(generateMessageResponse).mockResolvedValueOnce({
                text: 'Great resources!',
                action: null
            });

            await searchClient['engageWithSearchTerms']();

            expect(runtime.composeState).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    tweetContext: expect.stringContaining('URLs:')
                })
            );
        });
    });

    describe('Search Loop Timing', () => {
        it('should schedule next search with random delay', async () => {
            await searchClient['engageWithSearchTermsLoop']();

            // Check that a timer was set
            expect(vi.getTimerCount()).toBe(1);
            
            // Verify the delay is between 60-120 minutes
            const timers = vi.getTimersCount();
            expect(timers).toBeGreaterThan(0);
            
            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringMatching(/Next twitter search scheduled in \d+ minutes/)
            );
        });
    });
});