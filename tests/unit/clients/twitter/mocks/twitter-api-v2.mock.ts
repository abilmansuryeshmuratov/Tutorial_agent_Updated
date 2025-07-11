import type { Tweet } from "agent-twitter-client";

/**
 * Twitter API v2 Mock Factory
 * Provides mock data matching the official Twitter API v2 response structure
 * Reference: https://developer.twitter.com/en/docs/twitter-api
 */

// Mock tweet objects matching API v2 structure
export const mockTweets = {
    standard: {
        id: "1234567890123456789",
        text: "Hello Twitter! This is a test tweet.",
        created_at: "2024-01-01T12:00:00.000Z",
        author_id: "9876543210",
        conversation_id: "1234567890123456789",
        public_metrics: {
            retweet_count: 10,
            reply_count: 5,
            like_count: 20,
            quote_count: 2,
            bookmark_count: 3,
            impression_count: 150
        },
        entities: {
            urls: [],
            hashtags: [],
            mentions: []
        },
        edit_controls: {
            edits_remaining: 5,
            is_edit_eligible: true,
            editable_until: "2024-01-01T13:00:00.000Z"
        }
    },
    withMedia: {
        id: "1234567890123456790",
        text: "Check out this amazing photo!",
        created_at: "2024-01-01T13:00:00.000Z",
        author_id: "9876543210",
        conversation_id: "1234567890123456790",
        attachments: {
            media_keys: ["3_1234567890123456789"]
        },
        entities: {
            urls: [{
                start: 30,
                end: 53,
                url: "https://t.co/abc123",
                expanded_url: "https://pic.twitter.com/abc123",
                display_url: "pic.twitter.com/abc123",
                media_key: "3_1234567890123456789"
            }]
        }
    },
    reply: {
        id: "1234567890123456791",
        text: "@testuser Thanks for sharing!",
        created_at: "2024-01-01T14:00:00.000Z",
        author_id: "9876543211",
        conversation_id: "1234567890123456789",
        in_reply_to_user_id: "9876543210",
        referenced_tweets: [{
            type: "replied_to" as const,
            id: "1234567890123456789"
        }],
        entities: {
            mentions: [{
                start: 0,
                end: 9,
                username: "testuser",
                id: "9876543210"
            }]
        }
    },
    retweet: {
        id: "1234567890123456792",
        text: "RT @original: Great content!",
        created_at: "2024-01-01T15:00:00.000Z",
        author_id: "9876543212",
        conversation_id: "1234567890123456789",
        referenced_tweets: [{
            type: "retweeted" as const,
            id: "1234567890123456789"
        }]
    },
    quote: {
        id: "1234567890123456793",
        text: "This is an amazing thread! Must read 👇",
        created_at: "2024-01-01T16:00:00.000Z",
        author_id: "9876543213",
        conversation_id: "1234567890123456793",
        referenced_tweets: [{
            type: "quoted" as const,
            id: "1234567890123456789"
        }]
    },
    thread: {
        id: "1234567890123456794",
        text: "1/ Starting a thread about Twitter API v2",
        created_at: "2024-01-01T17:00:00.000Z",
        author_id: "9876543210",
        conversation_id: "1234567890123456794"
    },
    longTweet: {
        id: "1234567890123456795",
        text: "This is a very long tweet that exceeds the normal character limit. " +
              "It contains more than 280 characters and would require Twitter Blue " +
              "or a Note Tweet to post. Lorem ipsum dolor sit amet, consectetur " +
              "adipiscing elit. Sed do eiusmod tempor incididunt ut labore et " +
              "dolore magna aliqua. Ut enim ad minim veniam, quis nostrud " +
              "exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
        created_at: "2024-01-01T18:00:00.000Z",
        author_id: "9876543210",
        conversation_id: "1234567890123456795"
    }
};

// Mock user objects matching API v2 structure
export const mockUsers = {
    standard: {
        id: "9876543210",
        name: "Test User",
        username: "testuser",
        created_at: "2020-01-01T00:00:00.000Z",
        description: "Just a test user for Twitter API v2",
        location: "Internet",
        profile_image_url: "https://pbs.twimg.com/profile_images/test.jpg",
        public_metrics: {
            followers_count: 1000,
            following_count: 500,
            tweet_count: 5000,
            listed_count: 10
        },
        verified: false,
        verified_type: "none" as const
    },
    verified: {
        id: "9876543211",
        name: "Verified User",
        username: "verifieduser",
        created_at: "2019-01-01T00:00:00.000Z",
        description: "Official verified account",
        verified: true,
        verified_type: "blue" as const,
        public_metrics: {
            followers_count: 50000,
            following_count: 200,
            tweet_count: 10000,
            listed_count: 500
        }
    },
    protected: {
        id: "9876543212",
        name: "Protected User",
        username: "protecteduser",
        protected: true,
        public_metrics: {
            followers_count: 100,
            following_count: 150,
            tweet_count: 500,
            listed_count: 0
        }
    }
};

// Mock media objects matching API v2 structure
export const mockMedia = {
    photo: {
        media_key: "3_1234567890123456789",
        type: "photo" as const,
        url: "https://pbs.twimg.com/media/test.jpg",
        height: 1080,
        width: 1920,
        alt_text: "A test image for Twitter API v2"
    },
    video: {
        media_key: "13_1234567890123456789",
        type: "video" as const,
        duration_ms: 30000,
        height: 720,
        width: 1280,
        preview_image_url: "https://pbs.twimg.com/media/video_preview.jpg",
        public_metrics: {
            view_count: 1000
        }
    },
    gif: {
        media_key: "16_1234567890123456789",
        type: "animated_gif" as const,
        preview_image_url: "https://pbs.twimg.com/media/gif_preview.jpg",
        height: 480,
        width: 480
    }
};

// Mock API responses
export const mockApiResponses = {
    createTweet: {
        success: {
            data: {
                id: "1234567890123456789",
                text: "Hello Twitter!",
                edit_history_tweet_ids: ["1234567890123456789"]
            }
        },
        rateLimited: {
            title: "Too Many Requests",
            detail: "Too Many Requests",
            type: "https://api.twitter.com/2/problems/rate-limit",
            errors: [{
                code: 88,
                message: "Rate limit exceeded"
            }]
        },
        unauthorized: {
            title: "Unauthorized",
            detail: "Unauthorized",
            type: "https://api.twitter.com/2/problems/not-authorized",
            errors: [{
                code: 89,
                message: "Invalid or expired token"
            }]
        },
        duplicate: {
            title: "Forbidden",
            detail: "You already said that",
            type: "https://api.twitter.com/2/problems/duplicate",
            errors: [{
                code: 187,
                message: "Status is a duplicate"
            }]
        }
    },
    getTweet: {
        success: {
            data: mockTweets.standard
        },
        notFound: {
            errors: [{
                value: "1234567890123456789",
                detail: "Could not find tweet with id: [1234567890123456789].",
                title: "Not Found Error",
                resource_type: "tweet",
                parameter: "id",
                type: "https://api.twitter.com/2/problems/resource-not-found"
            }]
        }
    },
    searchTweets: {
        success: {
            data: [
                mockTweets.standard,
                mockTweets.reply,
                mockTweets.quote
            ],
            meta: {
                newest_id: "1234567890123456793",
                oldest_id: "1234567890123456789",
                result_count: 3,
                next_token: "abc123"
            }
        },
        empty: {
            meta: {
                result_count: 0
            }
        }
    },
    likeTweet: {
        success: {
            data: {
                liked: true
            }
        },
        alreadyLiked: {
            title: "Duplicate",
            detail: "You have already liked this Tweet",
            type: "https://api.twitter.com/2/problems/duplicate"
        }
    },
    retweet: {
        success: {
            data: {
                retweeted: true
            }
        },
        alreadyRetweeted: {
            title: "Duplicate",
            detail: "You have already retweeted this Tweet",
            type: "https://api.twitter.com/2/problems/duplicate"
        }
    }
};

// Mock rate limit headers
export const mockRateLimitHeaders = {
    standard: {
        'x-rate-limit-limit': '300',
        'x-rate-limit-remaining': '299',
        'x-rate-limit-reset': '1640995200'
    },
    nearLimit: {
        'x-rate-limit-limit': '300',
        'x-rate-limit-remaining': '5',
        'x-rate-limit-reset': '1640995200'
    },
    exceeded: {
        'x-rate-limit-limit': '300',
        'x-rate-limit-remaining': '0',
        'x-rate-limit-reset': '1640995200'
    }
};

// Mock error responses
export const mockErrors = {
    authentication: {
        status: 401,
        errors: [{
            code: 32,
            message: "Could not authenticate you"
        }]
    },
    notFound: {
        status: 404,
        errors: [{
            code: 34,
            message: "Sorry, that page does not exist"
        }]
    },
    rateLimited: {
        status: 429,
        errors: [{
            code: 88,
            message: "Rate limit exceeded"
        }]
    },
    forbidden: {
        status: 403,
        errors: [{
            code: 403,
            message: "Forbidden"
        }]
    },
    suspended: {
        status: 403,
        errors: [{
            code: 64,
            message: "Your account is suspended and is not permitted to access this feature"
        }]
    },
    tweetTooLong: {
        status: 403,
        errors: [{
            code: 186,
            message: "Tweet needs to be a bit shorter"
        }]
    },
    dailyLimit: {
        status: 403,
        errors: [{
            code: 185,
            message: "User is over daily status update limit"
        }]
    }
};

// Helper to create mock Tweet objects for the client
export function createMockTweet(overrides?: Partial<Tweet>): Tweet {
    return {
        id: "1234567890123456789",
        name: "Test User",
        username: "testuser",
        text: "Hello Twitter!",
        conversationId: "1234567890123456789",
        createdAt: "Mon Jan 01 12:00:00 +0000 2024",
        timestamp: Math.floor(Date.now() / 1000), // Twitter uses seconds, not milliseconds
        userId: "9876543210",
        inReplyToStatusId: null,
        permanentUrl: "https://twitter.com/testuser/status/1234567890123456789",
        hashtags: [],
        mentions: [],
        photos: [],
        thread: [],
        urls: [],
        videos: [],
        ...overrides
    } as Tweet;
}

// Helper to create mock API responses with proper structure
export function createMockApiResponse(data: any, headers?: Record<string, string>) {
    return {
        json: async () => data,
        headers: {
            get: (key: string) => headers?.[key] || null,
            ...headers
        },
        ok: !data.errors,
        status: data.errors ? 400 : 200
    };
}

// Mock timeline data
export const mockTimeline = [
    createMockTweet({
        id: "1234567890123456789",
        text: "Just launched our new feature! 🚀",
        timestamp: Math.floor(Date.now() / 1000) - 60 // 1 minute ago
    }),
    createMockTweet({
        id: "1234567890123456790",
        text: "Thanks for all the support @community!",
        mentions: ["@community"],
        timestamp: Math.floor(Date.now() / 1000) - 120 // 2 minutes ago
    }),
    createMockTweet({
        id: "1234567890123456791",
        text: "Working on some exciting updates #coding #typescript",
        hashtags: ["#coding", "#typescript"],
        timestamp: Math.floor(Date.now() / 1000) - 180 // 3 minutes ago
    })
];