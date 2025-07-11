import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TwitterPostClient } from '@elizaos/client-twitter/src/post';
import { IAgentRuntime, ModelClass, elizaLogger, generateText, generateTweetActions, truncateToCompleteSentence, parseJSONObjectFromText } from '@elizaos/core';
import { 
    mockTweets, 
    mockApiResponses, 
    createMockApiResponse, 
    mockRateLimitHeaders,
    createMockTweet 
} from './mocks/twitter-api-v2.mock';

// Setup core mocks similar to other test files
import { setupTwitterTestEnv, restoreProcessEnv } from './test-utils/env-mock';

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
        generateText: vi.fn().mockResolvedValue('Generated tweet content based on context'),
        generateTweetActions: vi.fn().mockResolvedValue([]),
        composeContext: vi.fn(),
        stringToUuid: vi.fn(str => `uuid-${str}`),
        getEmbeddingZeroVector: vi.fn(() => Array(1536).fill(0)),
        truncateToCompleteSentence: vi.fn((text, length) => {
            if (text.length <= length) return text;
            const truncated = text.substring(0, length);
            const lastPeriod = truncated.lastIndexOf('.');
            return lastPeriod > 0 ? truncated.substring(0, lastPeriod + 1) : truncated;
        }),
        parseJSONObjectFromText: vi.fn(text => {
            try {
                return JSON.parse(text);
            } catch {
                return null;
            }
        }),
        extractAttributes: vi.fn((text, attrs) => {
            const result: any = {};
            attrs.forEach(attr => {
                const regex = new RegExp(`${attr}:\\s*"([^"]+)"`, 'i');
                const match = text.match(regex);
                result[attr] = match ? match[1] : null;
            });
            return result;
        }),
        cleanJsonResponse: vi.fn(text => text.trim())
    };
});

describe('Twitter Post Validation Tests', () => {
    let postClient: TwitterPostClient;
    let mockClient: any;
    let runtime: IAgentRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        setupTwitterTestEnv();

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
                POST_INTERVAL_MIN: 90,
                POST_INTERVAL_MAX: 180,
                ENABLE_ACTION_PROCESSING: true,
                ACTION_INTERVAL: 5,
                POST_IMMEDIATELY: false,
                MAX_TWEET_LENGTH: 280,
                MAX_ACTIONS_PROCESSING: 10,
                TWITTER_TARGET_USERS: []
            },
            twitterClient: {
                sendTweet: vi.fn(),
                sendNoteTweet: vi.fn(),
                sendQuoteTweet: vi.fn(),
                likeTweet: vi.fn(),
                retweet: vi.fn(),
                getTweet: vi.fn()
            },
            requestQueue: {
                add: vi.fn().mockImplementation(async (fn) => fn())
            },
            cacheTweet: vi.fn(),
            saveRequestMessage: vi.fn(),
            fetchTimelineForActions: vi.fn(),
            cacheLatestCheckedTweetId: vi.fn(),
            lastCheckedTweetId: null
        };

        // Mock runtime
        runtime = {
            agentId: 'agent-123',
            character: {
                name: 'TestBot',
                bio: 'A test bot',
                topics: ['technology', 'AI'],
                style: {
                    all: ['friendly'],
                    chat: ['conversational'],
                    post: ['informative']
                },
                templates: {},
                messageExamples: [],
                postExamples: []
            },
            getSetting: vi.fn(key => {
                const settings: Record<string, string> = {
                    TWITTER_APPROVAL_ENABLED: 'false'
                };
                return settings[key] || null;
            }),
            cacheManager: {
                get: vi.fn(),
                set: vi.fn(),
                delete: vi.fn()
            },
            messageManager: {
                createMemory: vi.fn(),
                getMemoryById: vi.fn().mockResolvedValue(null)
            },
            ensureUserExists: vi.fn(),
            ensureRoomExists: vi.fn(),
            ensureParticipantInRoom: vi.fn(),
            ensureConnection: vi.fn(),
            composeState: vi.fn().mockResolvedValue({
                userId: 'agent-123',
                roomId: 'room-123',
                agentId: 'agent-123',
                content: { text: '', action: '' }
            }),
            updateRecentMessageState: vi.fn(state => state),
            processActions: vi.fn(),
            getService: vi.fn().mockReturnValue({
                describeImage: vi.fn().mockResolvedValue('An image description')
            })
        } as any;

        postClient = new TwitterPostClient(mockClient, runtime);
    });

    afterEach(() => {
        vi.clearAllMocks();
        restoreProcessEnv();
    });

    describe('Tweet Creation and Validation', () => {
        it('should validate tweet length before posting', async () => {
            const longText = 'a'.repeat(300);
            vi.mocked(generateText).mockResolvedValueOnce(longText);

            await postClient.generateNewTweet();

            // Should truncate to complete sentence within limit
            expect(truncateToCompleteSentence).toHaveBeenCalledWith(
                expect.any(String),
                280
            );
        });

        it('should handle standard tweet creation', async () => {
            const tweetText = 'Hello Twitter! This is a test tweet.';
            vi.mocked(generateText).mockResolvedValueOnce(tweetText);
            
            // Mock the API response
            const mockResponse = {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: tweetText,
                                        conversation_id_str: "1234567890123456789",
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            };
            
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(mockResponse);

            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockClient.requestQueue.add).toHaveBeenCalled();
            
            expect(mockClient.twitterClient.sendTweet).toHaveBeenCalledWith(
                tweetText,
                undefined,
                null
            );
        });

        it('should handle note tweets for long content', async () => {
            const longTweetText = 'a'.repeat(350);
            vi.mocked(generateText).mockResolvedValueOnce(longTweetText);
            mockClient.twitterClient.sendNoteTweet.mockResolvedValueOnce({
                data: {
                    notetweet_create: {
                        tweet_results: {
                            result: {
                                rest_id: "1234567890123456795",
                                legacy: {
                                    full_text: longTweetText,
                                    conversation_id_str: "1234567890123456795",
                                    created_at: new Date().toISOString(),
                                    in_reply_to_status_id_str: null
                                }
                            }
                        }
                    }
                }
            });

            // Check initial state
            expect(postClient['isDryRun']).toBe(false);
            
            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockClient.requestQueue.add).toHaveBeenCalled();
            
            expect(mockClient.twitterClient.sendNoteTweet).toHaveBeenCalledWith(
                longTweetText,
                undefined,
                null
            );
        });

        it('should fallback to standard tweet when note tweet fails', async () => {
            const longTweetText = 'a'.repeat(350);
            vi.mocked(generateText).mockResolvedValueOnce(longTweetText);
            
            // Note tweet fails
            mockClient.twitterClient.sendNoteTweet.mockResolvedValueOnce({
                errors: [{ message: 'Not authorized for note tweets' }]
            });
            
            // Standard tweet succeeds
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));


            expect(mockClient.twitterClient.sendNoteTweet).toHaveBeenCalled();
            expect(mockClient.twitterClient.sendTweet).toHaveBeenCalled();
            expect(truncateToCompleteSentence).toHaveBeenCalledWith(
                longTweetText,
                280
            );
        });

        it('should handle tweet with media attachments', async () => {
            const tweetWithMedia = {
                text: 'Check out this image!',
                attachments: ['https://example.com/image.jpg']
            };
            vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify(tweetWithMedia));
            vi.mocked(parseJSONObjectFromText).mockReturnValueOnce(tweetWithMedia);

            // Mock media fetch
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                blob: vi.fn().mockResolvedValueOnce(new Blob(['image data'])),
                headers: {
                    get: vi.fn().mockReturnValue('image/jpeg')
                }
            });

            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));


            expect(mockClient.twitterClient.sendTweet).toHaveBeenCalledWith(
                'Check out this image!',
                undefined,
                expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.any(Blob),
                        mediaType: 'image/jpeg'
                    })
                ])
            );
        });

        it('should clean and format tweet text properly', async () => {
            const rawTweet = '"Hello Twitter!\\nThis is a test."';
            vi.mocked(generateText).mockResolvedValueOnce(rawTweet);
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));


            // Should remove quotes and fix newlines
            expect(mockClient.twitterClient.sendTweet).toHaveBeenCalledWith(
                'Hello Twitter!\n\nThis is a test.',
                undefined,
                null
            );
        });
    });

    describe('API Response Validation', () => {
        it('should validate successful tweet creation response', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Test tweet');
            const response = {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            };
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(response);

            await postClient.generateNewTweet();

            const responseData = await response.json();
            expect(responseData.data.create_tweet.tweet_results.result).toHaveProperty('rest_id');
            expect(responseData.data.create_tweet.tweet_results.result.legacy).toHaveProperty('full_text');
            expect(responseData.data.create_tweet.tweet_results.result).toBeDefined();
        });

        it('should handle rate limit errors', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Test tweet');
            mockClient.twitterClient.sendTweet.mockRejectedValueOnce(
                mockApiResponses.createTweet.rateLimited
            );

            await postClient.generateNewTweet();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error sending tweet'),
                expect.any(Object)
            );
        });

        it('should handle duplicate tweet errors', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Duplicate tweet');
            mockClient.twitterClient.sendTweet.mockRejectedValueOnce(
                mockApiResponses.createTweet.duplicate
            );

            await postClient.generateNewTweet();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error sending tweet'),
                expect.objectContaining({
                    errors: expect.arrayContaining([
                        expect.objectContaining({ code: 187 })
                    ])
                })
            );
        });

        it('should handle authorization errors', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Test tweet');
            mockClient.twitterClient.sendTweet.mockRejectedValueOnce(
                mockApiResponses.createTweet.unauthorized
            );

            await postClient.generateNewTweet();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error sending tweet'),
                expect.objectContaining({
                    errors: expect.arrayContaining([
                        expect.objectContaining({ code: 89 })
                    ])
                })
            );
        });
    });

    describe('Tweet Actions Processing', () => {
        beforeEach(() => {
            // Mock timeline fetch
            mockClient.fetchTimelineForActions.mockResolvedValue([
                createMockTweet({ id: '1', text: 'Interesting tweet about AI' }),
                createMockTweet({ id: '2', text: 'Another tweet about technology' })
            ]);
        });

        it('should process and validate like actions', async () => {
            vi.mocked(generateTweetActions).mockResolvedValue({
                like: true,
                retweet: false,
                quote: false,
                reply: false
            });

            mockClient.twitterClient.likeTweet.mockResolvedValueOnce(
                createMockApiResponse(mockApiResponses.likeTweet.success)
            );

            const results = await postClient['processTweetActions']();

            expect(results).toHaveLength(2); // Processing both tweets
            expect(results[0].executedActions).toContain('like');
            expect(results[1].executedActions).toContain('like');
            expect(mockClient.twitterClient.likeTweet).toHaveBeenCalledWith('1');
            expect(mockClient.twitterClient.likeTweet).toHaveBeenCalledWith('2');
        });

        it('should handle already liked tweets', async () => {
            vi.mocked(generateTweetActions).mockResolvedValue({
                like: true,
                retweet: false,
                quote: false,
                reply: false
            });

            mockClient.twitterClient.likeTweet.mockRejectedValueOnce(
                mockApiResponses.likeTweet.alreadyLiked
            );

            const results = await postClient['processTweetActions']();

            expect(elizaLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Error liking tweet'),
                expect.any(Object)
            );
        });

        it('should process and validate retweet actions', async () => {
            vi.mocked(generateTweetActions).mockResolvedValue({
                like: false,
                retweet: true,
                quote: false,
                reply: false
            });

            mockClient.twitterClient.retweet.mockResolvedValueOnce(
                createMockApiResponse(mockApiResponses.retweet.success)
            );

            const results = await postClient['processTweetActions']();

            expect(results).toHaveLength(2); // Processing both tweets
            expect(results[0].executedActions).toContain('retweet');
            expect(results[1].executedActions).toContain('retweet');
            expect(mockClient.twitterClient.retweet).toHaveBeenCalledWith('1');
            expect(mockClient.twitterClient.retweet).toHaveBeenCalledWith('2');
        });

        it('should process quote tweets with proper validation', async () => {
            vi.mocked(generateTweetActions).mockResolvedValue({
                like: false,
                retweet: false,
                quote: true,
                reply: false
            });

            vi.mocked(generateText).mockResolvedValueOnce('Great insights here!');
            mockClient.twitterClient.sendQuoteTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            const results = await postClient['processTweetActions']();

            expect(results).toHaveLength(2); // Processing both tweets
            expect(results[0].executedActions).toContain('quote');
            expect(results[1].executedActions).toContain('quote');
            expect(mockClient.twitterClient.sendQuoteTweet).toHaveBeenCalledWith(
                'Great insights here!',
                '1'
            );
        });

        it('should process reply actions with context', async () => {
            vi.mocked(generateTweetActions).mockResolvedValue({
                like: false,
                retweet: false,
                quote: false,
                reply: true
            });

            vi.mocked(generateText).mockResolvedValueOnce('Thanks for sharing!');
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            const results = await postClient['processTweetActions']();

            expect(results).toHaveLength(2); // Processing both tweets
            expect(results[0].executedActions).toContain('reply');
            expect(results[1].executedActions).toContain('reply');
            expect(mockClient.twitterClient.sendTweet).toHaveBeenCalledWith(
                'Thanks for sharing!',
                '1',
                undefined
            );
        });
    });

    describe('Dry Run Mode', () => {
        beforeEach(() => {
            mockClient.twitterConfig.TWITTER_DRY_RUN = true;
            postClient = new TwitterPostClient(mockClient, runtime);
        });

        it('should not post tweets in dry run mode', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Test tweet in dry run');

            await postClient.generateNewTweet();

            expect(elizaLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('Dry run: would have posted tweet')
            );
            expect(mockClient.twitterClient.sendTweet).not.toHaveBeenCalled();
        });

        it('should not execute actions in dry run mode', async () => {
            mockClient.fetchTimelineForActions.mockResolvedValue([
                createMockTweet({ id: '1', text: 'Test tweet' })
            ]);

            vi.mocked(generateTweetActions).mockResolvedValue({
                like: true,
                retweet: true,
                quote: false,
                reply: false
            });

            const results = await postClient['processTweetActions']();

            expect(results[0].executedActions).toContain('like (dry run)');
            expect(results[0].executedActions).toContain('retweet (dry run)');
            expect(mockClient.twitterClient.likeTweet).not.toHaveBeenCalled();
            expect(mockClient.twitterClient.retweet).not.toHaveBeenCalled();
        });
    });

    describe('Memory and Cache Management', () => {
        it('should create memory for posted tweets', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Test tweet');
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(runtime.messageManager.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringContaining('uuid-'),
                    content: expect.objectContaining({
                        text: 'Test tweet',
                        source: 'twitter'
                    })
                })
            );
        });

        it('should cache last post timestamp', async () => {
            vi.mocked(generateText).mockResolvedValueOnce('Test tweet');
            mockClient.twitterClient.sendTweet.mockResolvedValueOnce(
                {
                json: vi.fn().mockResolvedValue({
                    data: {
                        create_tweet: {
                            tweet_results: {
                                result: {
                                    rest_id: "1234567890123456789",
                                    legacy: {
                                        full_text: "Tweet content",
                                        conversation_id_str: "1234567890123456789", 
                                        created_at: new Date().toISOString(),
                                        in_reply_to_status_id_str: null
                                    }
                                }
                            }
                        }
                    }
                })
            }
            );

            await postClient.generateNewTweet();

            // Wait for any pending async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(runtime.cacheManager.set).toHaveBeenCalledWith(
                'twitter/testbot/lastPost',
                expect.objectContaining({
                    timestamp: expect.any(Number)
                })
            );
        });

        it('should skip already processed tweets', async () => {
            runtime.messageManager.getMemoryById.mockResolvedValueOnce({
                id: 'existing-memory'
            });

            mockClient.fetchTimelineForActions.mockResolvedValue([
                createMockTweet({ id: '1', text: 'Already processed' })
            ]);

            const results = await postClient['processTweetActions']();

            expect(results).toHaveLength(0);
            expect(elizaLogger.log).toHaveBeenCalledWith(
                expect.stringContaining('Already processed tweet')
            );
        });
    });
});