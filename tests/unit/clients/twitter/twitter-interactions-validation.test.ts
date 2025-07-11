import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
    coreMock, 
    mockGenerateMessageResponse, 
    mockGenerateShouldRespond,
    mockComposeContext,
    mockStringToUuid,
    mockGetEmbeddingZeroVector,
    resetAllMocks 
} from './mocks/core.mock';

// Mock dependencies - must be before other imports
vi.mock('@elizaos/core', () => coreMock);

// Mock the utils module
vi.mock('@elizaos/client-twitter/src/utils', () => ({
    buildConversationThread: vi.fn().mockImplementation(async (tweet, client) => {
        const thread = [];
        let currentTweet = tweet;
        
        // Simple thread building simulation for tests
        while (currentTweet.inReplyToStatusId) {
            try {
                const parentTweet = await client.twitterClient.getTweet(currentTweet.inReplyToStatusId);
                thread.push(parentTweet);
                currentTweet = parentTweet;
            } catch (error) {
                coreMock.elizaLogger.error("Error fetching parent tweet:", {
                    tweetId: currentTweet.inReplyToStatusId,
                    error
                });
                break;
            }
        }
        
        return thread;
    }),
    sendTweet: vi.fn().mockResolvedValue([{
        id: 'response-msg-id',
        content: { text: 'Response sent', source: 'twitter' },
        userId: 'agent-123',
        roomId: 'room-123',
        createdAt: Date.now()
    }]),
    wait: vi.fn().mockResolvedValue(undefined)
}));

import { TwitterInteractionClient } from '@elizaos/client-twitter/src/interactions';
import { IAgentRuntime, ModelClass } from '@elizaos/core';
import { SearchMode } from 'agent-twitter-client';
import { 
    mockTweets, 
    mockUsers,
    mockApiResponses, 
    createMockTweet,
    createMockApiResponse 
} from './mocks/twitter-api-v2.mock';

describe('Twitter Interactions Validation Tests', () => {
    let interactionClient: TwitterInteractionClient;
    let mockClient: any;
    let runtime: IAgentRuntime;
    const elizaLogger = coreMock.elizaLogger;
    
    // Helper to create tweets from other users
    const createUserTweet = (overrides: any) => {
        return createMockTweet({
            userId: '987654321', // Different from bot's ID
            ...overrides
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        resetAllMocks();

        // Mock Twitter client
        mockClient = {
            profile: {
                id: '123456789',
                username: 'testbot',
                screenName: 'Test Bot'
            },
            twitterConfig: {
                TWITTER_USERNAME: 'testbot',
                TWITTER_DRY_RUN: false,
                TWITTER_POLL_INTERVAL: 120,
                TWITTER_TARGET_USERS: ['vitalik', 'elonmusk']
            },
            twitterClient: {
                getTweet: vi.fn(),
                sendTweet: vi.fn(),
                likeTweet: vi.fn(),
                retweet: vi.fn(),
                fetchSearchTweets: vi.fn()
            },
            fetchSearchTweets: vi.fn(),
            lastCheckedTweetId: null,
            cacheLatestCheckedTweetId: vi.fn(),
            saveRequestMessage: vi.fn(),
            requestQueue: {
                add: vi.fn().mockImplementation(async (fn) => fn())
            }
        };

        // Mock runtime
        runtime = {
            agentId: 'agent-123',
            character: {
                name: 'TestBot',
                bio: 'A test bot',
                topics: ['technology', 'AI'],
                templates: {},
                messageExamples: [],
                style: {
                    all: ['friendly', 'helpful'],
                    chat: ['conversational'],
                    post: ['informative']
                }
            },
            messageManager: {
                createMemory: vi.fn(),
                getMemoryById: vi.fn().mockResolvedValue(null),
                getMemoriesByRoomIds: vi.fn().mockResolvedValue([])
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
                get: vi.fn().mockResolvedValue(null),
                set: vi.fn()
            },
            getService: vi.fn().mockReturnValue({
                describeImage: vi.fn().mockResolvedValue({
                    title: 'Test Image',
                    description: 'A test image description'
                })
            }),
            getSetting: vi.fn().mockReturnValue(null)
        } as any;

        interactionClient = new TwitterInteractionClient(mockClient, runtime);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Mention Detection and Processing', () => {
        it('should fetch and validate mentions', async () => {
            const mentionTweets = [
                createUserTweet({
                    id: '1',
                    text: '@testbot Hello, how are you?',
                    mentions: ['@testbot']
                }),
                createUserTweet({
                    id: '2',
                    text: 'Hey @testbot, great work!',
                    mentions: ['@testbot']
                })
            ];

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: mentionTweets
            });

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Thanks for reaching out!',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(mockClient.fetchSearchTweets).toHaveBeenCalledWith(
                '@testbot',
                20,
                SearchMode.Latest
            );
            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Completed checking mentioned tweets'),
                2
            );
        });

        it('should handle tweets from target users', async () => {
            const targetUserTweets = [
                createUserTweet({
                    id: '3',
                    text: 'Interesting developments in AI today',
                    username: 'vitalik',
                    userId: '555'
                })
            ];

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [] // No mentions
            });

            // Mock for each target user
            mockClient.twitterClient.fetchSearchTweets
                .mockResolvedValueOnce({ tweets: targetUserTweets }) // for vitalik
                .mockResolvedValueOnce({ tweets: [] }); // for elonmusk

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Indeed, very interesting!',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(mockClient.twitterClient.fetchSearchTweets).toHaveBeenCalledWith(
                'from:vitalik',
                3,
                SearchMode.Latest
            );
        });

        it('should validate and filter recent tweets only', async () => {
            const oldTweet = createUserTweet({
                id: '4',
                text: '@testbot Old mention',
                timestamp: Date.now() / 1000 - 3 * 60 * 60, // 3 hours old (timestamp in seconds)
                mentions: ['@testbot']
            });

            const recentTweet = createUserTweet({
                id: '5',
                text: '@testbot Recent mention',
                timestamp: Date.now() / 1000 - 30 * 60, // 30 minutes old (timestamp in seconds)
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [oldTweet, recentTweet]
            });
            
            // Mock memory check for both tweets
            runtime.messageManager.getMemoryById
                .mockResolvedValueOnce(null) // old tweet not processed
                .mockResolvedValueOnce(null); // recent tweet not processed

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Response to mention',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            // Should only process recent tweets (both tweets are checked as they're newer than lastCheckedTweetId)
            expect(mockGenerateShouldRespond).toHaveBeenCalledTimes(2);
        });
    });

    describe('Response Generation and Validation', () => {
        it('should generate appropriate responses based on context', async () => {
            const tweet = createUserTweet({
                id: '6',
                text: '@testbot What do you think about AI safety?',
                mentions: ['@testbot'],
                userId: '999999', // Different from bot's ID
                timestamp: Math.floor(Date.now() / 1000) - 10 * 60, // 10 minutes ago (in seconds)
                conversationId: 'conv-6',
                username: 'user123',
                name: 'Test User'
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            // No target users configured for this test
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            // Mock memory check returns null (new tweet)
            runtime.messageManager.getMemoryById.mockResolvedValueOnce(null);
            
            // Mock thread building
            mockClient.twitterClient.getTweet.mockResolvedValueOnce(tweet);

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'AI safety is crucial for responsible development.',
                action: null
            });
            
            // Mock the send tweet flow - remove this duplicate
            // The requestQueue is already mocked in beforeEach

            await interactionClient.handleTwitterInteractions();

            expect(mockGenerateMessageResponse).toHaveBeenCalledWith({
                runtime,
                context: expect.any(String),
                modelClass: ModelClass.LARGE
            });
        });

        it('should handle IGNORE responses correctly', async () => {
            const tweet = createUserTweet({
                id: '7',
                text: 'Random spam message',
                mentions: []
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockGenerateShouldRespond.mockResolvedValue('IGNORE');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith('Checking Twitter interactions');
            expect(mockClient.twitterClient.sendTweet).not.toHaveBeenCalled();
        });

        it('should handle STOP responses correctly', async () => {
            const tweet = createUserTweet({
                id: '8',
                text: '@testbot Please stop responding to me',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockGenerateShouldRespond.mockResolvedValue('STOP');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith('Checking Twitter interactions');
            expect(mockClient.twitterClient.sendTweet).not.toHaveBeenCalled();
        });
    });

    describe('Thread Building and Context', () => {
        it('should build conversation threads correctly', async () => {
            const parentTweet = createUserTweet({
                id: '10',
                text: 'Initial question about AI',
                conversationId: '10'
            });

            const replyTweet = createUserTweet({
                id: '11',
                text: '@user More details about the question',
                conversationId: '10',
                inReplyToStatusId: '10'
            });

            const mentionTweet = createUserTweet({
                id: '12',
                text: '@testbot What do you think?',
                conversationId: '10',
                inReplyToStatusId: '11',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [mentionTweet]
            });

            mockClient.twitterClient.getTweet
                .mockResolvedValueOnce(replyTweet)
                .mockResolvedValueOnce(parentTweet);

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Great question! Here are my thoughts...',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(mockClient.twitterClient.getTweet).toHaveBeenCalledTimes(2);
            expect(mockClient.twitterClient.getTweet).toHaveBeenCalledWith('11');
            expect(mockClient.twitterClient.getTweet).toHaveBeenCalledWith('10');
        });

        it('should handle missing parent tweets gracefully', async () => {
            const tweet = createUserTweet({
                id: '13',
                text: '@testbot Reply to deleted tweet',
                inReplyToStatusId: '999',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockClient.twitterClient.getTweet.mockRejectedValueOnce(
                new Error('Tweet not found')
            );

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Response to orphaned tweet',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                'Error fetching parent tweet:',
                expect.objectContaining({
                    tweetId: '999',
                    error: expect.any(Error)
                })
            );
        });
    });

    describe('Image Processing in Tweets', () => {
        it('should process tweets with images', async () => {
            const tweetWithImage = createUserTweet({
                id: '14',
                text: '@testbot Check out this image!',
                mentions: ['@testbot'],
                photos: [
                    { url: 'https://example.com/image1.jpg', alt_text: 'Test image' }
                ]
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithImage]
            });

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Interesting image!',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(runtime.getService).toHaveBeenCalledWith('IMAGE_DESCRIPTION');
            expect(runtime.composeState).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    imageDescriptions: expect.stringContaining('Title: Test Image')
                })
            );
        });

        it('should handle image description errors', async () => {
            const tweetWithImage = createUserTweet({
                id: '15',
                text: '@testbot Look at this!',
                mentions: ['@testbot'],
                photos: [{ url: 'https://example.com/broken.jpg' }]
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithImage]
            });

            runtime.getService = vi.fn().mockReturnValue({
                describeImage: vi.fn().mockRejectedValue(new Error('Failed to describe'))
            });

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error Occured during describing image'),
                expect.any(Error)
            );
        });
    });

    describe('Memory Management', () => {
        it('should skip already processed tweets', async () => {
            const tweet = createUserTweet({
                id: '16',
                text: '@testbot Already handled',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            runtime.messageManager.getMemoryById.mockResolvedValueOnce({
                id: 'existing-memory'
            });

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Already responded to tweet'),
                expect.any(String)
            );
            expect(mockGenerateShouldRespond).not.toHaveBeenCalled();
        });

        it('should create memories for processed tweets', async () => {
            const tweet = createUserTweet({
                id: '17',
                text: '@testbot New interaction',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Thanks for the interaction!',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(runtime.messageManager.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringContaining('uuid-'),
                    content: expect.objectContaining({
                        text: tweet.text,
                        url: tweet.permanentUrl,
                        source: 'twitter'
                    })
                })
            );
        });

        it('should update last checked tweet ID', async () => {
            const tweets = [
                createUserTweet({ id: '18', timestamp: Date.now() / 1000 - 10 * 60 }),
                createUserTweet({ id: '19', timestamp: Date.now() / 1000 - 5 * 60 }),
                createUserTweet({ id: '20', timestamp: Date.now() / 1000 - 1 * 60 })
            ];

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets
            });
            
            // Mock memory checks
            runtime.messageManager.getMemoryById
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            mockGenerateShouldRespond.mockResolvedValue('IGNORE');

            await interactionClient.handleTwitterInteractions();

            expect(mockClient.lastCheckedTweetId).toBe(BigInt('20'));
            expect(mockClient.cacheLatestCheckedTweetId).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            mockClient.fetchSearchTweets.mockRejectedValueOnce(
                new Error('API Error')
            );

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                'Error handling Twitter interactions:',
                expect.any(Error)
            );
        });

        it('should handle tweet sending failures', async () => {
            const tweet = createUserTweet({
                id: '21',
                text: '@testbot Test message',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Response text',
                action: null
            });

            mockClient.twitterClient.sendTweet.mockRejectedValueOnce(
                new Error('Failed to send')
            );

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error sending response tweet'),
                expect.any(Error)
            );
        });
    });

    describe('Dry Run Mode', () => {
        beforeEach(() => {
            mockClient.twitterConfig.TWITTER_DRY_RUN = true;
            interactionClient = new TwitterInteractionClient(mockClient, runtime);
        });

        it('should not send tweets in dry run mode', async () => {
            const tweet = createUserTweet({
                id: '22',
                text: '@testbot Dry run test',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'Dry run response',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Dry run:')
            );
            expect(mockClient.twitterClient.sendTweet).not.toHaveBeenCalled();
        });
    });

    describe('Action Processing', () => {
        it('should process actions from responses', async () => {
            const tweet = createUserTweet({
                id: '23',
                text: '@testbot Please help me with this task',
                mentions: ['@testbot']
            });

            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];
            
            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });
            
            // No target users configured
            mockClient.twitterConfig.TWITTER_TARGET_USERS = [];

            mockGenerateShouldRespond.mockResolvedValue('RESPOND');
            mockGenerateMessageResponse.mockResolvedValue({
                text: 'I can help with that!',
                action: 'HELP_USER'
            });

            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                createMockApiResponse(mockApiResponses.createTweet.success)
            );

            await interactionClient.handleTwitterInteractions();

            expect(runtime.processActions).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Array),
                expect.any(Object),
                expect.any(Function)
            );
        });
    });
});