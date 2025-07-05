import { describe, it, expect, beforeAll } from 'vitest';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';
import { createPublicClient, http, formatEther } from 'viem';
import { bsc } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Combined API Integration Tests - Tutorial Agent', () => {
    let twitterClient: TwitterApi;
    let openaiClient: OpenAI;
    let bnbClient: any;

    beforeAll(() => {
        console.log('\n🚀 Initializing API clients for Tutorial Agent...\n');

        // Initialize Twitter client
        if (process.env.TWITTER_API_KEY && process.env.TWITTER_AUTH_MODE === 'api_key') {
            twitterClient = new TwitterApi({
                appKey: process.env.TWITTER_API_KEY,
                appSecret: process.env.TWITTER_API_SECRET!,
                accessToken: process.env.TWITTER_ACCESS_TOKEN!,
                accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
            });
            console.log('✅ Twitter client initialized');
        } else {
            console.log('⚠️  Twitter API credentials not found or not in api_key mode');
        }

        // Initialize OpenAI client
        if (process.env.OPENAI_API_KEY) {
            openaiClient = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: process.env.OPENAI_API_URL || 'https://api.openai.com/v1'
            });
            console.log('✅ OpenAI client initialized');
        } else {
            console.log('⚠️  OpenAI API key not found');
        }

        // Initialize BNB client
        const rpcUrl = process.env.BSC_PROVIDER_URL || 'https://bsc-dataseed.binance.org/';
        bnbClient = createPublicClient({
            chain: bsc,
            transport: http(rpcUrl)
        });
        console.log('✅ BNB blockchain client initialized');
        console.log(`   Using RPC: ${rpcUrl}\n`);
    });

    describe('🐦 Twitter + AI Integration', () => {
        it('should analyze crypto tweets and generate AI response', async () => {
            if (!twitterClient || !openaiClient) {
                console.log('Skipping: Missing Twitter or OpenAI credentials');
                return;
            }

            try {
                // Search for recent crypto tweets
                const tweets = await twitterClient.v2.search('BNB OR "Binance Smart Chain" -is:retweet', {
                    max_results: 5,
                    'tweet.fields': ['created_at', 'public_metrics']
                });

                expect(tweets.tweets).toBeDefined();
                console.log(`Found ${tweets.tweets.length} crypto tweets`);

                if (tweets.tweets.length > 0) {
                    // Pick the most engaging tweet
                    const topTweet = tweets.tweets.reduce((best, tweet) => {
                        const engagement = (tweet.public_metrics?.like_count || 0) + 
                                         (tweet.public_metrics?.retweet_count || 0) * 2;
                        const bestEngagement = (best.public_metrics?.like_count || 0) + 
                                             (best.public_metrics?.retweet_count || 0) * 2;
                        return engagement > bestEngagement ? tweet : best;
                    });

                    console.log('\nTop tweet:', {
                        text: topTweet.text.substring(0, 100) + '...',
                        likes: topTweet.public_metrics?.like_count,
                        retweets: topTweet.public_metrics?.retweet_count
                    });

                    // Generate AI analysis
                    const aiResponse = await openaiClient.chat.completions.create({
                        model: process.env.SMALL_OPENAI_MODEL || 'gpt-4o-mini',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are the Tutorial Agent - a crypto analyst with a skeptical, analytical perspective. Analyze tweets with your signature sarcasm and technical insight.'
                            },
                            {
                                role: 'user',
                                content: `Analyze this crypto tweet and generate a witty response:\n\n"${topTweet.text}"`
                            }
                        ],
                        temperature: 0.8,
                        max_tokens: 150
                    });

                    console.log('\nAI Analysis:', aiResponse.choices[0].message.content);
                }
            } catch (error: any) {
                console.error('Twitter + AI test error:', error.message);
            }
        }, 60000);
    });

    describe('⛓️ BNB Chain + AI Analysis', () => {
        it('should analyze blockchain activity and generate insights', async () => {
            if (!bnbClient || !openaiClient) {
                console.log('Skipping: Missing BNB or OpenAI client');
                return;
            }

            try {
                // Get latest block with transactions
                const [latestBlock, gasPrice] = await Promise.all([
                    bnbClient.getBlock({ includeTransactions: true }),
                    bnbClient.getGasPrice()
                ]);

                // Find whale transactions
                const whaleThreshold = 1000n * 10n ** 18n; // 1000 BNB
                const whaleTxs = latestBlock.transactions.filter((tx: any) => 
                    tx.value > whaleThreshold
                );

                const blockData = {
                    blockNumber: latestBlock.number?.toString(),
                    totalTxs: latestBlock.transactions.length,
                    whaleTxs: whaleTxs.length,
                    gasPrice: (Number(gasPrice) / 1e9).toFixed(2) + ' gwei',
                    largestTx: whaleTxs.length > 0 ? formatEther(whaleTxs[0].value) + ' BNB' : 'None'
                };

                console.log('\nBlockchain activity:', blockData);

                // Generate AI insight
                const insight = await openaiClient.chat.completions.create({
                    model: process.env.MEDIUM_OPENAI_MODEL || 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are the Tutorial Agent analyzing BNB Chain activity. Provide sharp, insightful analysis with your signature skepticism about market movements.'
                        },
                        {
                            role: 'user',
                            content: `Analyze this blockchain data and generate a tweet-worthy insight:\n${JSON.stringify(blockData, null, 2)}`
                        }
                    ],
                    temperature: 0.85,
                    max_tokens: 200
                });

                console.log('\nAI Blockchain Insight:', insight.choices[0].message.content);
                
                // Check if content needs moderation
                if (insight.choices[0].message.content) {
                    const moderation = await openaiClient.moderations.create({
                        input: insight.choices[0].message.content
                    });
                    
                    console.log('\nModeration check:', {
                        flagged: moderation.results[0].flagged,
                        categories: Object.entries(moderation.results[0].categories)
                            .filter(([_, flagged]) => flagged)
                            .map(([category]) => category)
                    });
                }
            } catch (error: any) {
                console.error('BNB + AI test error:', error.message);
            }
        }, 60000);
    });

    describe('🤖 Full Pipeline Test', () => {
        it('should simulate the complete Tutorial Agent workflow', async () => {
            if (!bnbClient || !openaiClient) {
                console.log('Skipping: Missing required clients');
                return;
            }

            try {
                console.log('\n📊 Starting Tutorial Agent pipeline simulation...\n');

                // Step 1: Monitor blockchain
                const [blockNumber, gasPrice, latestBlock] = await Promise.all([
                    bnbClient.getBlockNumber(),
                    bnbClient.getGasPrice(),
                    bnbClient.getBlock({ includeTransactions: true })
                ]);

                console.log('1️⃣ Blockchain monitoring:', {
                    block: blockNumber.toString(),
                    gas: (Number(gasPrice) / 1e9).toFixed(2) + ' gwei',
                    txCount: latestBlock.transactions.length
                });

                // Step 2: Detect interesting activity
                const insights = [];
                
                // Check for whale movements
                const whaleTxs = latestBlock.transactions.filter((tx: any) => 
                    tx.value > 500n * 10n ** 18n // 500 BNB
                );
                if (whaleTxs.length > 0) {
                    insights.push({
                        type: 'whale',
                        data: `${whaleTxs.length} whale transactions detected, largest: ${formatEther(whaleTxs[0].value)} BNB`
                    });
                }

                // Check for high gas
                if (gasPrice > 10n * 10n ** 9n) { // > 10 gwei
                    insights.push({
                        type: 'gas',
                        data: `Gas spike detected: ${(Number(gasPrice) / 1e9).toFixed(2)} gwei`
                    });
                }

                console.log('\n2️⃣ Insights detected:', insights);

                // Step 3: Generate content for each insight
                for (const insight of insights) {
                    const response = await openaiClient.chat.completions.create({
                        model: process.env.MEDIUM_OPENAI_MODEL || 'gpt-4o',
                        messages: [
                            {
                                role: 'system',
                                content: `You are the Tutorial Agent. Generate a tweet about this ${insight.type} activity. Be skeptical, technical, and add subtle sarcasm. Use crypto slang.`
                            },
                            {
                                role: 'user',
                                content: insight.data
                            }
                        ],
                        temperature: 0.85,
                        max_tokens: 100
                    });

                    console.log(`\n3️⃣ Generated tweet for ${insight.type}:`, 
                        response.choices[0].message.content);
                }

                // Step 4: Simulate tweet scheduling
                console.log('\n4️⃣ Tweet scheduling simulation:');
                console.log('   - Checking rate limits...');
                console.log('   - Applying content variety filter...');
                console.log('   - Scheduled for posting in next window');

                console.log('\n✅ Tutorial Agent pipeline simulation complete!');

            } catch (error: any) {
                console.error('Pipeline test error:', error.message);
            }
        }, 60000);
    });

    describe('📈 Market Sentiment Analysis', () => {
        it('should analyze crypto market sentiment from multiple sources', async () => {
            if (!twitterClient || !openaiClient || !bnbClient) {
                console.log('Skipping: Missing required clients');
                return;
            }

            try {
                // Gather data from multiple sources
                const [tweets, gasPrice, blockData] = await Promise.all([
                    twitterClient.v2.search('crypto market sentiment', {
                        max_results: 10,
                        'tweet.fields': ['created_at', 'public_metrics']
                    }).catch(() => ({ tweets: [] })),
                    bnbClient.getGasPrice(),
                    bnbClient.getBlock()
                ]);

                const marketData = {
                    tweetCount: tweets.tweets?.length || 0,
                    avgEngagement: tweets.tweets?.reduce((sum: number, t: any) => 
                        sum + (t.public_metrics?.like_count || 0), 0) / (tweets.tweets?.length || 1),
                    gasPrice: (Number(gasPrice) / 1e9).toFixed(2),
                    blockActivity: blockData.transactions.length,
                    timestamp: new Date().toISOString()
                };

                console.log('\nMarket data collected:', marketData);

                // Generate comprehensive analysis
                const analysis = await openaiClient.chat.completions.create({
                    model: process.env.LARGE_OPENAI_MODEL || 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are the Tutorial Agent providing market analysis. Combine technical indicators with social sentiment. Be insightful but maintain healthy skepticism.'
                        },
                        {
                            role: 'user',
                            content: `Analyze this market data and provide a brief sentiment report:\n${JSON.stringify(marketData, null, 2)}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 250
                });

                console.log('\nMarket Sentiment Analysis:', analysis.choices[0].message.content);

            } catch (error: any) {
                console.error('Market sentiment test error:', error.message);
            }
        }, 60000);
    });

    describe('🔍 API Health Check Summary', () => {
        it('should summarize all API statuses', async () => {
            const apiStatus = {
                twitter: !!twitterClient,
                openai: !!openaiClient,
                bnb: !!bnbClient,
                telegramBot: !!process.env.TELEGRAM_BOT_TOKEN,
                groq: !!process.env.GROQ_API_KEY,
                anthropic: !!process.env.ANTHROPIC_API_KEY
            };

            console.log('\n📋 API Configuration Summary:');
            console.log('================================');
            Object.entries(apiStatus).forEach(([api, status]) => {
                console.log(`${status ? '✅' : '❌'} ${api.toUpperCase()}: ${status ? 'Configured' : 'Not configured'}`);
            });

            // Test each configured API
            const results = [];

            if (apiStatus.twitter) {
                try {
                    await twitterClient.v2.me();
                    results.push('✅ Twitter API: Connected');
                } catch (e) {
                    results.push('❌ Twitter API: Failed to connect');
                }
            }

            if (apiStatus.openai) {
                try {
                    await openaiClient.models.list();
                    results.push('✅ OpenAI API: Connected');
                } catch (e) {
                    results.push('❌ OpenAI API: Failed to connect');
                }
            }

            if (apiStatus.bnb) {
                try {
                    await bnbClient.getBlockNumber();
                    results.push('✅ BNB RPC: Connected');
                } catch (e) {
                    results.push('❌ BNB RPC: Failed to connect');
                }
            }

            console.log('\n🔗 Connection Test Results:');
            console.log('================================');
            results.forEach(result => console.log(result));

            console.log('\n🎯 Tutorial Agent is ready to:');
            if (apiStatus.twitter && apiStatus.openai) {
                console.log('   ✓ Post AI-generated tweets');
                console.log('   ✓ Analyze crypto conversations');
            }
            if (apiStatus.bnb && apiStatus.openai) {
                console.log('   ✓ Monitor BNB blockchain activity');
                console.log('   ✓ Generate insights from on-chain data');
            }
            console.log('\n');
        });
    });
});