import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TwitterInteractionClient } from '@elizaos/client-twitter/src/interactions';
import { IAgentRuntime, ModelClass, elizaLogger, generateMessageResponse, generateShouldRespond } from '@elizaos/core';
import { SearchMode } from 'agent-twitter-client';
import { 
    mockTweets, 
    mockUsers,
    mockApiResponses, 
    createMockTweet,
    createMockApiResponse 
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
        generateMessageResponse: vi.fn().mockResolvedValue({ text: 'Generated response' }),
        generateShouldRespond: vi.fn().mockResolvedValue('RESPOND'),
        composeContext: vi.fn(),
        stringToUuid: vi.fn(str => `uuid-${str}`),
        getEmbeddingZeroVector: vi.fn(() => Array(1536).fill(0))
    };
});

describe('Twitter Interactions Validation Tests', () => {
    let interactionClient: TwitterInteractionClient;
    let mockClient: any;
    let runtime: IAgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();

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
            saveRequestMessage: vi.fn()
        };

        // Mock runtime
        runtime = {
            agentId: 'agent-123',
            character: {
                name: 'TestBot',
                bio: 'A test bot',
                topics: ['technology', 'AI'],
                templates: {},
                messageExamples: []
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
                describeImage: vi.fn().mockResolvedValue({
                    title: 'Test Image',
                    description: 'A test image description'
                })
            })
        } as any;

        interactionClient = new TwitterInteractionClient(mockClient, runtime);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Mention Detection and Processing', () => {
        it('should fetch and validate mentions', async () => {
            const mentionTweets = [
                createMockTweet({
                    id: '1',
                    text: '@testbot Hello, how are you?',
                    mentions: ['@testbot']
                }),
                createMockTweet({
                    id: '2',
                    text: 'Hey @testbot, great work!',
                    mentions: ['@testbot']
                })
            ];

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: mentionTweets
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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
                createMockTweet({
                    id: '3',
                    text: 'Interesting developments in AI today',
                    username: 'vitalik',
                    userId: '555'
                })
            ];

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [] // No mentions
            });

            mockClient.twitterClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: targetUserTweets
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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
            const oldTweet = createMockTweet({
                id: '4',
                text: '@testbot Old mention',
                timestamp: Date.now() - 3 * 60 * 60 * 1000 // 3 hours old
            });

            const recentTweet = createMockTweet({
                id: '5',
                text: '@testbot Recent mention',
                timestamp: Date.now() - 30 * 60 * 1000 // 30 minutes old
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [oldTweet, recentTweet]
            });

            mockClient.twitterClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: []
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');

            await interactionClient.handleTwitterInteractions();

            // Should only process recent tweets
            expect(vi.mocked(generateShouldRespond)).toHaveBeenCalledTimes(2);
        });
    });

    describe('Response Generation and Validation', () => {
        it('should generate appropriate responses based on context', async () => {
            const tweet = createMockTweet({
                id: '6',
                text: '@testbot What do you think about AI safety?',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
                text: 'AI safety is crucial for responsible development.',
                action: null
            });

            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                createMockApiResponse(mockApiResponses.createTweet.success)
            );

            await interactionClient.handleTwitterInteractions();

            expect(vi.mocked(generateMessageResponse)).toHaveBeenCalledWith({
                runtime,
                context: expect.any(String),
                modelClass: ModelClass.LARGE
            });
        });

        it('should handle IGNORE responses correctly', async () => {
            const tweet = createMockTweet({
                id: '7',
                text: 'Random spam message',
                mentions: []
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('IGNORE');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith('Not responding to message');
            expect(mockClient.twitterClient.sendTweet).not.toHaveBeenCalled();
        });

        it('should handle STOP responses correctly', async () => {
            const tweet = createMockTweet({
                id: '8',
                text: '@testbot Please stop responding to me',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('STOP');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith('Not responding to message');
            expect(mockClient.twitterClient.sendTweet).not.toHaveBeenCalled();
        });
    });

    describe('Thread Building and Context', () => {
        it('should build conversation threads correctly', async () => {
            const parentTweet = createMockTweet({
                id: '10',
                text: 'Initial question about AI',
                conversationId: '10'
            });

            const replyTweet = createMockTweet({
                id: '11',
                text: '@user More details about the question',
                conversationId: '10',
                inReplyToStatusId: '10'
            });

            const mentionTweet = createMockTweet({
                id: '12',
                text: '@testbot What do you think?',
                conversationId: '10',
                inReplyToStatusId: '11',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [mentionTweet]
            });

            mockClient.twitterClient.getTweet
                .mockResolvedValueOnce(replyTweet)
                .mockResolvedValueOnce(parentTweet);

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
                text: 'Great question! Here are my thoughts...',
                action: null
            });

            await interactionClient.handleTwitterInteractions();

            expect(mockClient.twitterClient.getTweet).toHaveBeenCalledTimes(2);
            expect(mockClient.twitterClient.getTweet).toHaveBeenCalledWith('11');
            expect(mockClient.twitterClient.getTweet).toHaveBeenCalledWith('10');
        });

        it('should handle missing parent tweets gracefully', async () => {
            const tweet = createMockTweet({
                id: '13',
                text: '@testbot Reply to deleted tweet',
                inReplyToStatusId: '999',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            mockClient.twitterClient.getTweet.mockRejectedValueOnce(
                new Error('Tweet not found')
            );

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Error fetching parent tweet'),
                expect.any(Object)
            );
        });
    });

    describe('Image Processing in Tweets', () => {
        it('should process tweets with images', async () => {
            const tweetWithImage = createMockTweet({
                id: '14',
                text: '@testbot Check out this image!',
                mentions: ['@testbot'],
                photos: [
                    { url: 'https://example.com/image1.jpg', alt_text: 'Test image' }
                ]
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithImage]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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
            const tweetWithImage = createMockTweet({
                id: '15',
                text: '@testbot Look at this!',
                mentions: ['@testbot'],
                photos: [{ url: 'https://example.com/broken.jpg' }]
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweetWithImage]
            });

            runtime.getService = vi.fn().mockReturnValue({
                describeImage: vi.fn().mockRejectedValue(new Error('Failed to describe'))
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error Occured during describing image'),
                expect.any(Error)
            );
        });
    });

    describe('Memory Management', () => {
        it('should skip already processed tweets', async () => {
            const tweet = createMockTweet({
                id: '16',
                text: '@testbot Already handled',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            runtime.messageManager.getMemoryById.mockResolvedValueOnce({
                id: 'existing-memory'
            });

            await interactionClient.handleTwitterInteractions();

            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Already responded to tweet'),
                expect.any(String)
            );
            expect(vi.mocked(generateShouldRespond)).not.toHaveBeenCalled();
        });

        it('should create memories for processed tweets', async () => {
            const tweet = createMockTweet({
                id: '17',
                text: '@testbot New interaction',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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
                createMockTweet({ id: '18' }),
                createMockTweet({ id: '19' }),
                createMockTweet({ id: '20' })
            ];

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('IGNORE');

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
            const tweet = createMockTweet({
                id: '21',
                text: '@testbot Test message',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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
            const tweet = createMockTweet({
                id: '22',
                text: '@testbot Dry run test',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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
            const tweet = createMockTweet({
                id: '23',
                text: '@testbot Please help me with this task',
                mentions: ['@testbot']
            });

            mockClient.fetchSearchTweets.mockResolvedValueOnce({
                tweets: [tweet]
            });

            vi.mocked(generateShouldRespond).mockResolvedValue('RESPOND');
            vi.mocked(generateMessageResponse).mockResolvedValue({
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