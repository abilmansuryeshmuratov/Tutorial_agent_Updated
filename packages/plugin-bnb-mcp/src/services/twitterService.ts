import { 
    elizaLogger, 
    type IAgentRuntime,
    generateText,
    ModelClass
} from "@elizaos/core";
import type { BNBMCPInsight } from "../types";
import { PersonalityContentGenerator } from "./personalityContentGenerator";
import { ContentEnhancer } from "./contentEnhancer";

export class TwitterService {
    private runtime: IAgentRuntime;
    private lastTweetedInsights: Set<string> = new Set();
    private recentPosts: string[] = [];
    private personalityGenerator: PersonalityContentGenerator;
    private contentEnhancer: ContentEnhancer;
    
    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        this.personalityGenerator = new PersonalityContentGenerator();
        this.contentEnhancer = new ContentEnhancer();
    }
    
    /**
     * Generate tweet text from insight using OpenAI
     */
    async generateTweetText(insight: BNBMCPInsight): Promise<string> {
        const hasOpenAI = !!this.runtime.getSetting("OPENAI_API_KEY");
        
        // Use personality generator for both API and fallback scenarios
        if (!hasOpenAI) {
            elizaLogger.info("No OpenAI key, using personality-driven fallback");
            const fallbackContent = this.personalityGenerator.generateContent(insight, false);
            
            // Add variety based on recent posts
            const finalContent = this.personalityGenerator.addVariety(fallbackContent, this.recentPosts);
            
            // Add hashtags
            return this.addHashtags(finalContent, insight);
        }
        
        // When we have OpenAI, use personality-enriched prompt
        const personalityPrompt = this.personalityGenerator.createPersonalityPrompt(insight);
        
        const modelConfig = {
            temperature: this.runtime.getSetting("CONTENT_TEMPERATURE") ? 
                parseFloat(this.runtime.getSetting("CONTENT_TEMPERATURE")) : 0.85,
            maxTokens: 100,
            presencePenalty: this.runtime.getSetting("CONTENT_PRESENCE_PENALTY") ? 
                parseFloat(this.runtime.getSetting("CONTENT_PRESENCE_PENALTY")) : 0.5,
            frequencyPenalty: 0.3
        };
        
        try {
            const tweetText = await generateText({
                runtime: this.runtime,
                context: personalityPrompt + "\n\nGenerate a tweet (max 240 chars):",
                modelClass: ModelClass.SMALL,
                ...modelConfig
            });
            
            let generatedText = tweetText.trim();
            
            // Determine sentiment
            const sentiment = this.determineSentiment(insight);
            
            // Enhance with personality
            generatedText = this.contentEnhancer.enhanceContent(generatedText, sentiment);
            
            // Add technical context if needed
            generatedText = this.contentEnhancer.addTechnicalContext(generatedText, insight.data);
            
            // Make sarcastic if appropriate
            if (insight.type === 'new_contract' || insight.severity === 'low') {
                generatedText = this.contentEnhancer.makeSarcastic(generatedText);
            }
            
            // Ensure variety
            generatedText = this.contentEnhancer.ensureVariety(generatedText, this.recentPosts);
            
            return this.addHashtags(generatedText, insight);
        } catch (error) {
            elizaLogger.error("Failed to generate tweet with OpenAI:", error);
            // Fallback to personality generator
            let fallbackContent = this.personalityGenerator.generateContent(insight, false);
            
            // Enhance fallback content too
            const sentiment = this.determineSentiment(insight);
            fallbackContent = this.contentEnhancer.enhanceContent(fallbackContent, sentiment);
            fallbackContent = this.contentEnhancer.ensureVariety(fallbackContent, this.recentPosts);
            
            return this.addHashtags(fallbackContent, insight);
        }
    }
    
    /**
     * Add relevant hashtags to tweet
     */
    private addHashtags(content: string, insight: BNBMCPInsight): string {
        const hashtags: string[] = [];
        
        // Add hashtags based on insight type
        switch (insight.type) {
            case 'large_transfer':
            case 'whale_activity':
                hashtags.push('#WhaleAlert', '#BNBChain');
                break;
            case 'new_contract':
            case 'token_launch':
                hashtags.push('#BSC', '#DeFi');
                break;
            default:
                hashtags.push('#BNB', '#Crypto');
        }
        
        // Only add hashtags if there's room
        const hashtagString = '\n\n' + hashtags.join(' ');
        if (content.length + hashtagString.length <= 260) {
            return content + hashtagString;
        }
        
        return content;
    }
    
    /**
     * Determine sentiment of insight
     */
    private determineSentiment(insight: BNBMCPInsight): 'positive' | 'negative' | 'neutral' {
        // High severity is usually negative
        if (insight.severity === 'high') {
            // Unless it's whale accumulation
            if (insight.description.toLowerCase().includes('accumul')) {
                return 'positive';
            }
            return 'negative';
        }
        
        // Check for positive indicators
        const positiveKeywords = ['bullish', 'growth', 'adoption', 'milestone', 'record'];
        const negativeKeywords = ['dump', 'sell', 'rug', 'exploit', 'hack', 'scam'];
        
        const description = insight.description.toLowerCase();
        
        const hasPositive = positiveKeywords.some(keyword => description.includes(keyword));
        const hasNegative = negativeKeywords.some(keyword => description.includes(keyword));
        
        if (hasPositive && !hasNegative) return 'positive';
        if (hasNegative && !hasPositive) return 'negative';
        
        return 'neutral';
    }
    
    /**
     * Post insight to Twitter
     */
    async postInsight(insight: BNBMCPInsight): Promise<boolean> {
        // Check if we've already tweeted about this
        const insightKey = `${insight.type}-${insight.title}`;
        if (this.lastTweetedInsights.has(insightKey)) {
            elizaLogger.debug("Skipping duplicate insight:", insightKey);
            return false;
        }
        
        try {
            // Generate tweet text
            const tweetText = await this.generateTweetText(insight);
            
            // Add transaction link if available
            let finalTweet = tweetText;
            if ('hash' in insight.data && insight.data.hash) {
                const bscScanLink = `\n\nhttps://bscscan.com/tx/${insight.data.hash}`;
                if (finalTweet.length + bscScanLink.length <= 280) {
                    finalTweet += bscScanLink;
                }
            } else if ('contractAddress' in insight.data && insight.data.contractAddress) {
                const bscScanLink = `\n\nhttps://bscscan.com/address/${insight.data.contractAddress}`;
                if (finalTweet.length + bscScanLink.length <= 280) {
                    finalTweet += bscScanLink;
                }
            }
            
            elizaLogger.info(`Posting tweet: ${finalTweet}`);
            
            // Post to Twitter
            const twitterClient = this.runtime.clients?.twitter;
            if (twitterClient && typeof twitterClient.post === 'function') {
                await twitterClient.post({
                    text: finalTweet,
                    inReplyTo: null,
                });
                
                // Remember this insight
                this.lastTweetedInsights.add(insightKey);
                
                // Keep only last 100 insights in memory
                if (this.lastTweetedInsights.size > 100) {
                    const keysArray = Array.from(this.lastTweetedInsights);
                    this.lastTweetedInsights.delete(keysArray[0]);
                }
                
                // Track recent posts for variety
                this.recentPosts.unshift(finalTweet);
                if (this.recentPosts.length > 10) {
                    this.recentPosts.pop();
                }
                
                elizaLogger.info("Tweet posted successfully!");
                return true;
            } else {
                elizaLogger.warn("Twitter client not available");
                
                // Store for later if caching is available
                if (this.runtime.cacheManager) {
                    await this.runtime.cacheManager.set(
                        `pending-tweet-${Date.now()}`,
                        { text: finalTweet, insight }
                    );
                }
                return false;
            }
        } catch (error) {
            elizaLogger.error("Failed to post tweet:", error);
            return false;
        }
    }
    
    /**
     * Post multiple insights with rate limiting
     */
    async postInsights(insights: BNBMCPInsight[], maxTweets: number = 3): Promise<number> {
        let posted = 0;
        
        for (const insight of insights.slice(0, maxTweets)) {
            if (await this.postInsight(insight)) {
                posted++;
                
                // Wait between tweets to avoid rate limiting
                if (posted < maxTweets && insights.length > posted) {
                    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
                }
            }
        }
        
        return posted;
    }
}