import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type State,
    type HandlerCallback,
    elizaLogger,
    composeContext,
    generateObjectDeprecated,
    ModelClass,
} from "@elizaos/core";
import { BNBMCPClient } from "../services/mcpClient";
import { InsightAnalyzer } from "../services/insightAnalyzer";
import { TwitterService } from "../services/twitterService";
import type { BNBMCPInsight } from "../types";

export const bnbMcpInsightsAction: Action = {
    name: "BNB_MCP_INSIGHTS",
    description: "Fetch and analyze BNB Chain insights using MCP, optionally posting to Twitter",
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        const startTime = Date.now();
        elizaLogger.log("Starting BNB MCP insights action...");
        
        try {
            // Initialize services with all configuration
            const rpcUrl = runtime.getSetting("RPC_URL") || runtime.getSetting("BNB_RPC_URL");
            const blockRange = runtime.getSetting("RPC_BLOCK_RANGE");
            const retryAttempts = runtime.getSetting("RPC_RETRY_ATTEMPTS");
            
            const mcpClient = new BNBMCPClient({
                env: {
                    PRIVATE_KEY: runtime.getSetting("BNB_PRIVATE_KEY") || "",
                    RPC_URL: rpcUrl,
                    RPC_BLOCK_RANGE: blockRange,
                    RPC_RETRY_ATTEMPTS: retryAttempts,
                    RPC_CACHE_TTL: runtime.getSetting("RPC_CACHE_TTL")
                }
            });
            const analyzer = new InsightAnalyzer();
            const twitterService = new TwitterService(runtime);
            
            // Fetch data from MCP with individual error handling
            elizaLogger.info("Fetching blockchain data from BNB MCP...");
            
            const fetchPromises = [
                mcpClient.getLargeTransactions("100", 20).catch(err => {
                    elizaLogger.error("Failed to fetch large transactions:", err);
                    return [];
                }),
                mcpClient.getNewContracts(200).catch(err => {
                    elizaLogger.error("Failed to fetch new contracts:", err);
                    return [];
                }),
                mcpClient.getTokenTransfers(undefined, 50).catch(err => {
                    elizaLogger.error("Failed to fetch token transfers:", err);
                    return [];
                })
            ];
            
            const [transactions, newContracts, tokenTransfers] = await Promise.all(fetchPromises);
            
            elizaLogger.info(`Fetched: ${transactions.length} transactions, ${newContracts.length} contracts, ${tokenTransfers.length} transfers`);
            
            // Analyze data for insights
            const insights: BNBMCPInsight[] = [
                ...analyzer.analyzeTransactions(transactions),
                ...analyzer.analyzeNewContracts(newContracts),
                ...analyzer.analyzeTokenTransfers(tokenTransfers)
            ];
            
            // Filter and sort insights
            const filteredInsights = analyzer.filterInsights(insights, 'medium');
            
            elizaLogger.info(`Found ${filteredInsights.length} noteworthy insights`);
            
            // Check if we should post to Twitter
            const shouldTweet = runtime.getSetting("BNB_MCP_AUTO_TWEET") === "true";
            let tweetCount = 0;
            
            if (shouldTweet && filteredInsights.length > 0) {
                tweetCount = await twitterService.postInsights(filteredInsights, 2);
            }
            
            // Prepare response
            const responseText = filteredInsights.length > 0
                ? `Found ${filteredInsights.length} BNB Chain insights:\n\n${
                    filteredInsights.slice(0, 5).map((insight, i) => 
                        `${i + 1}. ${insight.title}\n   ${insight.description}`
                    ).join('\n\n')
                  }${filteredInsights.length > 5 ? `\n\n...and ${filteredInsights.length - 5} more` : ''}${
                    shouldTweet ? `\n\nPosted ${tweetCount} tweets.` : ''
                  }`
                : "No significant BNB Chain activity detected in recent blocks.";
            
            // Log metrics
            const duration = Date.now() - startTime;
            elizaLogger.info(`BNB MCP insights action completed in ${duration}ms`, {
                insightsFound: filteredInsights.length,
                tweetsPosted: tweetCount,
                transactionsFetched: transactions.length,
                contractsFetched: newContracts.length,
                transfersFetched: tokenTransfers.length
            });
            
            // Store metrics if cache manager available
            if (runtime.cacheManager) {
                await runtime.cacheManager.set(
                    `bnb-mcp-action-metrics-${Date.now()}`,
                    {
                        timestamp: Date.now(),
                        duration,
                        insightsFound: filteredInsights.length,
                        tweetsPosted: tweetCount,
                        dataFetched: {
                            transactions: transactions.length,
                            contracts: newContracts.length,
                            transfers: tokenTransfers.length
                        }
                    }
                );
            }
            
            if (callback) {
                callback({
                    text: responseText,
                    content: {
                        insights: filteredInsights,
                        tweeted: tweetCount
                    }
                });
            }
            
            return true;
        } catch (error) {
            const duration = Date.now() - startTime;
            elizaLogger.error("BNB MCP insights action failed:", {
                error: error.message,
                stack: error.stack,
                duration
            });
            
            if (callback) {
                callback({
                    text: `Failed to fetch BNB Chain insights: ${error.message}`,
                    content: { error: error.message }
                });
            }
            return false;
        }
    },
    
    validate: async (_runtime: IAgentRuntime) => {
        // This action can always be attempted
        return true;
    },
    
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check BNB chain for interesting activity"
                }
            },
            {
                user: "{{agent}}",
                content: {
                    text: "I'll analyze recent BNB Chain activity for noteworthy events...",
                    action: "BNB_MCP_INSIGHTS"
                }
            }
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Any whale movements on BSC?"
                }
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Let me check for large transactions and whale activity on BNB Chain...",
                    action: "BNB_MCP_INSIGHTS"
                }
            }
        ]
    ],
    
    similes: ["BSC_INSIGHTS", "BNB_ANALYTICS", "CHAIN_ANALYSIS", "WHALE_WATCH"]
};