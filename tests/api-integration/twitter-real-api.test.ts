import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Twitter Real API Integration Tests', () => {
    let client: TwitterApi;
    let authedClient: TwitterApi;

    beforeAll(() => {
        // Check if required credentials are available
        const requiredEnvVars = [
            'TWITTER_API_KEY',
            'TWITTER_API_SECRET',
            'TWITTER_ACCESS_TOKEN',
            'TWITTER_ACCESS_TOKEN_SECRET'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Initialize Twitter client with OAuth 1.0a credentials
        client = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY!,
            appSecret: process.env.TWITTER_API_SECRET!,
            accessToken: process.env.TWITTER_ACCESS_TOKEN!,
            accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
        });

        authedClient = client.readWrite;
    });

    describe('Account Verification', () => {
        it('should verify credentials and get authenticated user info', async () => {
            try {
                const me = await authedClient.v2.me();
                
                expect(me.data).toBeDefined();
                expect(me.data.id).toBeDefined();
                expect(me.data.username).toBeDefined();
                expect(me.data.name).toBeDefined();
                
                console.log('Authenticated as:', {
                    id: me.data.id,
                    username: me.data.username,
                    name: me.data.name
                });
            } catch (error: any) {
                console.error('Twitter API Error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Rate Limits', () => {
        it('should check rate limit status', async () => {
            try {
                const rateLimits = await authedClient.v1.rateLimitStatuses();
                
                expect(rateLimits).toBeDefined();
                expect(rateLimits.resources).toBeDefined();
                
                // Check specific endpoint limits
                const userTimelineLimits = rateLimits.resources.statuses?.['/statuses/user_timeline'];
                if (userTimelineLimits) {
                    console.log('User timeline rate limits:', {
                        limit: userTimelineLimits.limit,
                        remaining: userTimelineLimits.remaining,
                        reset: new Date(userTimelineLimits.reset * 1000).toISOString()
                    });
                }
            } catch (error: any) {
                console.error('Rate limit check error:', error);
                // Don't fail the test on rate limit errors
                if (error.code !== 429) {
                    throw error;
                }
            }
        }, 30000);
    });

    describe('Timeline Operations', () => {
        it('should fetch home timeline', async () => {
            try {
                const timeline = await authedClient.v2.homeTimeline({
                    max_results: 5,
                    'tweet.fields': ['created_at', 'author_id', 'public_metrics']
                });

                expect(timeline.tweets).toBeDefined();
                expect(Array.isArray(timeline.tweets)).toBe(true);
                
                console.log(`Fetched ${timeline.tweets.length} tweets from home timeline`);
                
                // Log first tweet if available
                if (timeline.tweets.length > 0) {
                    const firstTweet = timeline.tweets[0];
                    console.log('First tweet:', {
                        id: firstTweet.id,
                        text: firstTweet.text.substring(0, 50) + '...',
                        metrics: firstTweet.public_metrics
                    });
                }
            } catch (error: any) {
                console.error('Timeline fetch error:', error);
                // Don't fail if rate limited
                if (error.code !== 429) {
                    throw error;
                }
            }
        }, 30000);

        it('should search for tweets about crypto', async () => {
            try {
                const searchResults = await authedClient.v2.search('crypto OR blockchain -is:retweet', {
                    max_results: 10,
                    'tweet.fields': ['created_at', 'author_id', 'public_metrics']
                });

                expect(searchResults.tweets).toBeDefined();
                expect(Array.isArray(searchResults.tweets)).toBe(true);
                
                console.log(`Found ${searchResults.tweets.length} tweets about crypto`);
                
                // Analyze engagement
                if (searchResults.tweets.length > 0) {
                    const totalLikes = searchResults.tweets.reduce((sum, tweet) => 
                        sum + (tweet.public_metrics?.like_count || 0), 0
                    );
                    const avgLikes = totalLikes / searchResults.tweets.length;
                    console.log(`Average likes per tweet: ${avgLikes.toFixed(2)}`);
                }
            } catch (error: any) {
                console.error('Search error:', error);
                if (error.code !== 429) {
                    throw error;
                }
            }
        }, 30000);
    });

    describe('User Operations', () => {
        it('should get user by username', async () => {
            try {
                const user = await authedClient.v2.userByUsername('elonmusk', {
                    'user.fields': ['public_metrics', 'description', 'created_at']
                });

                expect(user.data).toBeDefined();
                expect(user.data.username).toBe('elonmusk');
                expect(user.data.public_metrics).toBeDefined();
                
                console.log('User info:', {
                    name: user.data.name,
                    followers: user.data.public_metrics?.followers_count,
                    following: user.data.public_metrics?.following_count,
                    tweets: user.data.public_metrics?.tweet_count
                });
            } catch (error: any) {
                console.error('User lookup error:', error);
                if (error.code !== 429) {
                    throw error;
                }
            }
        }, 30000);

        it('should get user followers', async () => {
            try {
                const me = await authedClient.v2.me();
                const followers = await authedClient.v2.followers(me.data.id, {
                    max_results: 5,
                    'user.fields': ['public_metrics', 'created_at']
                });

                expect(followers.data).toBeDefined();
                expect(Array.isArray(followers.data)).toBe(true);
                
                console.log(`Retrieved ${followers.data.length} followers`);
                
                // Log follower details
                followers.data.forEach(follower => {
                    console.log(`- @${follower.username} (${follower.public_metrics?.followers_count} followers)`);
                });
            } catch (error: any) {
                console.error('Followers fetch error:', error);
                if (error.code !== 429) {
                    throw error;
                }
            }
        }, 30000);
    });

    describe('Tweet Analysis', () => {
        it('should analyze recent tweets for crypto content', async () => {
            try {
                const recentTweets = await authedClient.v2.search('BNB OR "Binance Smart Chain" -is:retweet', {
                    max_results: 20,
                    'tweet.fields': ['created_at', 'public_metrics', 'entities'],
                    'expansions': ['author_id'],
                    'user.fields': ['public_metrics']
                });

                expect(recentTweets.tweets).toBeDefined();
                
                // Analyze hashtags
                const hashtags: Record<string, number> = {};
                recentTweets.tweets.forEach(tweet => {
                    tweet.entities?.hashtags?.forEach(tag => {
                        hashtags[tag.tag] = (hashtags[tag.tag] || 0) + 1;
                    });
                });

                console.log('Popular hashtags:', Object.entries(hashtags)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([tag, count]) => `#${tag} (${count})`)
                    .join(', '));

                // Find most engaging tweet
                const mostEngaging = recentTweets.tweets.reduce((best, tweet) => {
                    const engagement = (tweet.public_metrics?.like_count || 0) + 
                                     (tweet.public_metrics?.retweet_count || 0) * 2;
                    const bestEngagement = (best.public_metrics?.like_count || 0) + 
                                         (best.public_metrics?.retweet_count || 0) * 2;
                    return engagement > bestEngagement ? tweet : best;
                });

                console.log('Most engaging tweet:', {
                    text: mostEngaging.text.substring(0, 100) + '...',
                    likes: mostEngaging.public_metrics?.like_count,
                    retweets: mostEngaging.public_metrics?.retweet_count,
                    replies: mostEngaging.public_metrics?.reply_count
                });
            } catch (error: any) {
                console.error('Tweet analysis error:', error);
                if (error.code !== 429) {
                    throw error;
                }
            }
        }, 30000);
    });

    describe('Moderation Check', () => {
        it('should test if moderation settings would block certain content', async () => {
            // This tests the moderation thresholds from env
            const moderationSettings = {
                enabled: process.env.TWITTER_MODERATION_ENABLED === 'true',
                hateThreshold: parseFloat(process.env.TWITTER_MODERATION_THRESHOLD_HATE || '0.5'),
                violenceThreshold: parseFloat(process.env.TWITTER_MODERATION_THRESHOLD_VIOLENCE || '0.5'),
                blockReasons: process.env.TWITTER_MODERATION_BLOCK_REASONS?.split(',') || ['hate', 'violence'],
                onlyReplies: process.env.TWITTER_MODERATION_ONLY_REPLIES === 'true'
            };

            console.log('Current moderation settings:', moderationSettings);

            expect(moderationSettings.enabled).toBe(true);
            expect(moderationSettings.hateThreshold).toBeGreaterThanOrEqual(0);
            expect(moderationSettings.hateThreshold).toBeLessThanOrEqual(1);
            expect(moderationSettings.violenceThreshold).toBeGreaterThanOrEqual(0);
            expect(moderationSettings.violenceThreshold).toBeLessThanOrEqual(1);
        });
    });

    afterAll(() => {
        console.log('\nTwitter API integration tests completed');
    });
});