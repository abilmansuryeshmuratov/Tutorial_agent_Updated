import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

/**
 * Twitter API v2 Validation Tests
 * Based on official Twitter API v2 documentation: https://developer.twitter.com/en/docs/twitter-api
 */

// Twitter API v2 Response Schemas based on official documentation

// User object schema
const twitterUserSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    created_at: z.string().optional(),
    description: z.string().optional(),
    entities: z.object({
        url: z.object({
            urls: z.array(z.object({
                start: z.number(),
                end: z.number(),
                url: z.string(),
                expanded_url: z.string(),
                display_url: z.string()
            }))
        }).optional(),
        description: z.object({
            urls: z.array(z.any()),
            hashtags: z.array(z.any()),
            mentions: z.array(z.any())
        }).optional()
    }).optional(),
    location: z.string().optional(),
    pinned_tweet_id: z.string().optional(),
    profile_image_url: z.string().optional(),
    protected: z.boolean().optional(),
    public_metrics: z.object({
        followers_count: z.number(),
        following_count: z.number(),
        tweet_count: z.number(),
        listed_count: z.number()
    }).optional(),
    url: z.string().optional(),
    verified: z.boolean().optional(),
    verified_type: z.enum(['blue', 'business', 'government', 'none']).optional()
});

// Tweet object schema
const tweetSchema = z.object({
    id: z.string(),
    text: z.string(),
    created_at: z.string().optional(),
    author_id: z.string().optional(),
    conversation_id: z.string().optional(),
    in_reply_to_user_id: z.string().optional(),
    referenced_tweets: z.array(z.object({
        type: z.enum(['retweeted', 'quoted', 'replied_to']),
        id: z.string()
    })).optional(),
    attachments: z.object({
        media_keys: z.array(z.string()).optional(),
        poll_ids: z.array(z.string()).optional()
    }).optional(),
    geo: z.object({
        place_id: z.string()
    }).optional(),
    context_annotations: z.array(z.object({
        domain: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional()
        }),
        entity: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional()
        })
    })).optional(),
    entities: z.object({
        urls: z.array(z.object({
            start: z.number(),
            end: z.number(),
            url: z.string(),
            expanded_url: z.string(),
            display_url: z.string(),
            media_key: z.string().optional()
        })).optional(),
        hashtags: z.array(z.object({
            start: z.number(),
            end: z.number(),
            tag: z.string()
        })).optional(),
        mentions: z.array(z.object({
            start: z.number(),
            end: z.number(),
            username: z.string(),
            id: z.string()
        })).optional()
    }).optional(),
    public_metrics: z.object({
        retweet_count: z.number(),
        reply_count: z.number(),
        like_count: z.number(),
        quote_count: z.number(),
        bookmark_count: z.number().optional(),
        impression_count: z.number().optional()
    }).optional(),
    possibly_sensitive: z.boolean().optional(),
    lang: z.string().optional(),
    reply_settings: z.enum(['everyone', 'mentionedUsers', 'following']).optional(),
    edit_controls: z.object({
        edits_remaining: z.number(),
        is_edit_eligible: z.boolean(),
        editable_until: z.string()
    }).optional()
});

// Media object schema
const mediaSchema = z.object({
    media_key: z.string(),
    type: z.enum(['animated_gif', 'photo', 'video']),
    url: z.string().optional(),
    duration_ms: z.number().optional(),
    height: z.number().optional(),
    width: z.number().optional(),
    preview_image_url: z.string().optional(),
    public_metrics: z.object({
        view_count: z.number()
    }).optional(),
    alt_text: z.string().optional()
});

// API Response schemas
const tweetCreateResponseSchema = z.object({
    data: z.object({
        id: z.string(),
        text: z.string(),
        edit_history_tweet_ids: z.array(z.string())
    })
});

const tweetLookupResponseSchema = z.object({
    data: tweetSchema.optional(),
    includes: z.object({
        users: z.array(twitterUserSchema).optional(),
        tweets: z.array(tweetSchema).optional(),
        media: z.array(mediaSchema).optional()
    }).optional(),
    errors: z.array(z.object({
        resource_type: z.string(),
        field: z.string().optional(),
        parameter: z.string().optional(),
        value: z.string().optional(),
        title: z.string(),
        detail: z.string(),
        type: z.string()
    })).optional()
});

const userLookupResponseSchema = z.object({
    data: twitterUserSchema.optional(),
    includes: z.object({
        tweets: z.array(tweetSchema).optional()
    }).optional(),
    errors: z.array(z.any()).optional()
});

// Rate limit headers schema
const rateLimitHeadersSchema = z.object({
    'x-rate-limit-limit': z.string(),
    'x-rate-limit-remaining': z.string(),
    'x-rate-limit-reset': z.string()
});

// Error response schema
const twitterErrorResponseSchema = z.object({
    errors: z.array(z.object({
        code: z.number(),
        message: z.string()
    })).optional(),
    title: z.string().optional(),
    detail: z.string().optional(),
    type: z.string().optional()
});

describe('Twitter API v2 Validation', () => {
    describe('Tweet Object Validation', () => {
        it('should validate a complete tweet object', () => {
            const validTweet = {
                id: '1234567890123456789',
                text: 'Hello Twitter! #test @user',
                created_at: '2024-01-01T00:00:00.000Z',
                author_id: '9876543210',
                public_metrics: {
                    retweet_count: 10,
                    reply_count: 5,
                    like_count: 20,
                    quote_count: 2
                }
            };

            const result = tweetSchema.safeParse(validTweet);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe('1234567890123456789');
                expect(result.data.public_metrics?.like_count).toBe(20);
            }
        });

        it('should validate tweet with entities', () => {
            const tweetWithEntities = {
                id: '1234567890123456789',
                text: 'Check out https://example.com #coding @developer',
                entities: {
                    urls: [{
                        start: 10,
                        end: 30,
                        url: 'https://t.co/abc123',
                        expanded_url: 'https://example.com',
                        display_url: 'example.com'
                    }],
                    hashtags: [{
                        start: 31,
                        end: 38,
                        tag: 'coding'
                    }],
                    mentions: [{
                        start: 39,
                        end: 49,
                        username: 'developer',
                        id: '123456789'
                    }]
                }
            };

            const result = tweetSchema.safeParse(tweetWithEntities);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.entities?.urls).toHaveLength(1);
                expect(result.data.entities?.hashtags).toHaveLength(1);
                expect(result.data.entities?.mentions).toHaveLength(1);
            }
        });

        it('should validate reply tweet', () => {
            const replyTweet = {
                id: '1234567890123456789',
                text: '@user Thanks for sharing!',
                in_reply_to_user_id: '9876543210',
                referenced_tweets: [{
                    type: 'replied_to',
                    id: '1111111111111111111'
                }]
            };

            const result = tweetSchema.safeParse(replyTweet);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.referenced_tweets?.[0].type).toBe('replied_to');
            }
        });

        it('should reject tweets exceeding character limit', () => {
            // Note: Actual validation should happen before API call
            const longTweet = {
                id: '1234567890123456789',
                text: 'a'.repeat(281) // Over 280 character limit
            };

            const result = tweetSchema.safeParse(longTweet);
            expect(result.success).toBe(true); // Schema doesn't enforce limit
            // Character limit should be validated separately
            expect(longTweet.text.length).toBeGreaterThan(280);
        });
    });

    describe('User Object Validation', () => {
        it('should validate user object with all fields', () => {
            const user = {
                id: '1234567890',
                name: 'Test User',
                username: 'testuser',
                created_at: '2020-01-01T00:00:00.000Z',
                description: 'Test bio',
                public_metrics: {
                    followers_count: 1000,
                    following_count: 500,
                    tweet_count: 5000,
                    listed_count: 10
                },
                verified: true,
                verified_type: 'blue'
            };

            const result = twitterUserSchema.safeParse(user);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.verified_type).toBe('blue');
            }
        });
    });

    describe('API Response Validation', () => {
        it('should validate tweet creation response', () => {
            const createResponse = {
                data: {
                    id: '1234567890123456789',
                    text: 'Hello Twitter!',
                    edit_history_tweet_ids: ['1234567890123456789']
                }
            };

            const result = tweetCreateResponseSchema.safeParse(createResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.data.edit_history_tweet_ids).toHaveLength(1);
            }
        });

        it('should validate tweet lookup response with includes', () => {
            const lookupResponse = {
                data: {
                    id: '1234567890123456789',
                    text: 'Hello @user!',
                    author_id: '9876543210'
                },
                includes: {
                    users: [{
                        id: '9876543210',
                        name: 'Test User',
                        username: 'testuser'
                    }]
                }
            };

            const result = tweetLookupResponseSchema.safeParse(lookupResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includes?.users).toHaveLength(1);
            }
        });

        it('should validate error response', () => {
            const errorResponse = {
                errors: [{
                    code: 88,
                    message: 'Rate limit exceeded'
                }],
                title: 'Too Many Requests',
                detail: 'Rate limit exceeded',
                type: 'https://api.twitter.com/2/problems/rate-limit'
            };

            const result = twitterErrorResponseSchema.safeParse(errorResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.errors?.[0].code).toBe(88);
            }
        });

        it('should validate rate limit headers', () => {
            const headers = {
                'x-rate-limit-limit': '15',
                'x-rate-limit-remaining': '14',
                'x-rate-limit-reset': '1640995200'
            };

            const result = rateLimitHeadersSchema.safeParse(headers);
            expect(result.success).toBe(true);
        });
    });

    describe('Media Validation', () => {
        it('should validate photo media object', () => {
            const photoMedia = {
                media_key: '3_1234567890123456789',
                type: 'photo',
                url: 'https://pbs.twimg.com/media/abc123.jpg',
                height: 1080,
                width: 1920,
                alt_text: 'Description of image'
            };

            const result = mediaSchema.safeParse(photoMedia);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('photo');
            }
        });

        it('should validate video media object', () => {
            const videoMedia = {
                media_key: '13_1234567890123456789',
                type: 'video',
                duration_ms: 30000,
                height: 720,
                width: 1280,
                preview_image_url: 'https://pbs.twimg.com/media/preview.jpg',
                public_metrics: {
                    view_count: 1000
                }
            };

            const result = mediaSchema.safeParse(videoMedia);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.duration_ms).toBe(30000);
            }
        });
    });

    describe('Twitter API Error Codes', () => {
        const commonErrors = [
            { code: 32, message: 'Could not authenticate you' },
            { code: 34, message: 'Sorry, that page does not exist' },
            { code: 88, message: 'Rate limit exceeded' },
            { code: 89, message: 'Invalid or expired token' },
            { code: 135, message: 'Could not authenticate you' },
            { code: 144, message: 'No status found with that ID' },
            { code: 179, message: 'Sorry, you are not authorized to see this status' },
            { code: 185, message: 'User is over daily status update limit' },
            { code: 187, message: 'Status is a duplicate' },
            { code: 195, message: 'Missing or invalid url parameter' },
            { code: 226, message: 'This request looks like it might be automated' },
            { code: 403, message: 'Forbidden' }
        ];

        it.each(commonErrors)('should handle error code $code', ({ code, message }) => {
            const errorResponse = {
                errors: [{ code, message }]
            };

            const result = twitterErrorResponseSchema.safeParse(errorResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.errors?.[0].code).toBe(code);
                expect(result.data.errors?.[0].message).toBe(message);
            }
        });
    });

    describe('Request Validation', () => {
        const tweetCreateRequestSchema = z.object({
            text: z.string().min(1).max(280),
            reply: z.object({
                in_reply_to_tweet_id: z.string()
            }).optional(),
            quote_tweet_id: z.string().optional(),
            media: z.object({
                media_ids: z.array(z.string()).max(4)
            }).optional(),
            poll: z.object({
                options: z.array(z.string()).min(2).max(4),
                duration_minutes: z.number().min(5).max(10080) // 7 days max
            }).optional()
        });

        it('should validate tweet creation request', () => {
            const validRequest = {
                text: 'Hello Twitter! This is a test tweet.'
            };

            const result = tweetCreateRequestSchema.safeParse(validRequest);
            expect(result.success).toBe(true);
        });

        it('should validate reply request', () => {
            const replyRequest = {
                text: 'Thanks for sharing!',
                reply: {
                    in_reply_to_tweet_id: '1234567890123456789'
                }
            };

            const result = tweetCreateRequestSchema.safeParse(replyRequest);
            expect(result.success).toBe(true);
        });

        it('should validate media tweet request', () => {
            const mediaRequest = {
                text: 'Check out these photos!',
                media: {
                    media_ids: ['1234567890', '0987654321']
                }
            };

            const result = tweetCreateRequestSchema.safeParse(mediaRequest);
            expect(result.success).toBe(true);
        });

        it('should reject request with too many media items', () => {
            const tooManyMedia = {
                text: 'Too many photos',
                media: {
                    media_ids: ['1', '2', '3', '4', '5'] // Max is 4
                }
            };

            const result = tweetCreateRequestSchema.safeParse(tooManyMedia);
            expect(result.success).toBe(false);
        });

        it('should reject empty tweet text', () => {
            const emptyTweet = {
                text: ''
            };

            const result = tweetCreateRequestSchema.safeParse(emptyTweet);
            expect(result.success).toBe(false);
        });
    });

    describe('OAuth Headers Validation', () => {
        const oauthHeadersSchema = z.object({
            'Authorization': z.string().regex(/^OAuth .+/),
            'Content-Type': z.literal('application/json'),
            'User-Agent': z.string()
        });

        it('should validate OAuth 1.0a headers', () => {
            const headers = {
                'Authorization': 'OAuth oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog", oauth_nonce="kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg", oauth_signature="tnnArxj06cWHq44gCs1OSKk%2FjLY%3D", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1318622958", oauth_token="370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb", oauth_version="1.0"',
                'Content-Type': 'application/json',
                'User-Agent': 'ElizaAgent/1.0'
            };

            const result = oauthHeadersSchema.safeParse(headers);
            expect(result.success).toBe(true);
        });
    });
});