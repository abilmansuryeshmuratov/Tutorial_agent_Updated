import { 
    type Service,
    type IAgentRuntime,
    elizaLogger 
} from "@elizaos/core";
import { BNBMCPClient } from "./mcpClient";
import { InsightAnalyzer } from "./insightAnalyzer";
import { TwitterService } from "./twitterService";

export class ScheduledInsightsService implements Service {
    name = "bnbMcpScheduledInsights";
    private runtime: IAgentRuntime;
    private intervalId?: NodeJS.Timeout;
    private mcpClient: BNBMCPClient;
    private analyzer: InsightAnalyzer;
    private twitterService: TwitterService;
    private isHealthy: boolean = false;
    private lastHealthCheck: number = 0;
    
    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
        
        // Initialize with all available environment settings
        const rpcUrl = runtime.getSetting("RPC_URL") || runtime.getSetting("BNB_RPC_URL");
        const blockRange = runtime.getSetting("RPC_BLOCK_RANGE");
        const retryAttempts = runtime.getSetting("RPC_RETRY_ATTEMPTS");
        
        this.mcpClient = new BNBMCPClient({
            env: {
                PRIVATE_KEY: runtime.getSetting("BNB_PRIVATE_KEY") || "",
                RPC_URL: rpcUrl,
                RPC_BLOCK_RANGE: blockRange,
                RPC_RETRY_ATTEMPTS: retryAttempts
            }
        });
        this.analyzer = new InsightAnalyzer();
        this.twitterService = new TwitterService(runtime);
        
        elizaLogger.info("BNB MCP Service initialized with settings:", {
            hasRpcUrl: !!rpcUrl,
            blockRange: blockRange || "default",
            retryAttempts: retryAttempts || "default"
        });
    }
    
    async initialize(): Promise<void> {
        const enabled = this.runtime.getSetting("BNB_MCP_SCHEDULED_INSIGHTS") === "true";
        if (!enabled) {
            elizaLogger.info("BNB MCP scheduled insights are disabled");
            return;
        }
        
        // Perform health check before starting
        elizaLogger.info("Performing initial health check for BNB MCP service...");
        const healthy = await this.performHealthCheck();
        
        if (!healthy) {
            elizaLogger.error("BNB MCP service health check failed - service will run in degraded mode");
            // Continue anyway but log the issue
        }
        
        const intervalMinutes = parseInt(this.runtime.getSetting("BNB_MCP_CHECK_INTERVAL") || "30");
        elizaLogger.info(`Starting BNB MCP scheduled insights (interval: ${intervalMinutes} minutes)`);
        
        // Run once on startup only if healthy
        if (this.isHealthy) {
            try {
                await this.checkAndPostInsights();
            } catch (error) {
                elizaLogger.error("Initial insight check failed:", error);
            }
        }
        
        // Schedule periodic checks
        this.intervalId = setInterval(
            () => this.checkAndPostInsights(),
            intervalMinutes * 60 * 1000
        );
    }
    
    private async performHealthCheck(): Promise<boolean> {
        try {
            elizaLogger.info("Checking RPC connection health...");
            
            // Test basic RPC connectivity
            const gasPrice = await this.mcpClient.getGasPrice();
            if (!gasPrice || gasPrice === "0") {
                elizaLogger.warn("RPC health check: Unable to fetch gas price");
                this.isHealthy = false;
                return false;
            }
            
            // Test block number fetch
            const testClient = new BNBMCPClient(this.mcpClient['config']);
            const blockNumber = await testClient['client'].getBlockNumber();
            
            elizaLogger.info(`RPC health check passed - Current block: ${blockNumber}, Gas: ${gasPrice}`);
            this.isHealthy = true;
            this.lastHealthCheck = Date.now();
            return true;
            
        } catch (error) {
            elizaLogger.error("RPC health check failed:", error);
            this.isHealthy = false;
            return false;
        }
    }
    
    async stop(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            elizaLogger.info("BNB MCP scheduled insights stopped");
        }
    }
    
    private async checkAndPostInsights(): Promise<void> {
        elizaLogger.info("Running scheduled BNB Chain insight check...");
        
        // Perform periodic health check (every 10 cycles)
        const timeSinceLastCheck = Date.now() - this.lastHealthCheck;
        if (timeSinceLastCheck > 10 * 60 * 1000) { // 10 minutes
            await this.performHealthCheck();
        }
        
        if (!this.isHealthy) {
            elizaLogger.warn("Skipping insight check - service is unhealthy");
            return;
        }
        
        try {
            // Fetch data from MCP with individual error handling
            const fetchPromises = [
                this.mcpClient.getLargeTransactions("500", 10).catch(err => {
                    elizaLogger.error("Failed to fetch large transactions:", err);
                    return [];
                }),
                this.mcpClient.getNewContracts(100).catch(err => {
                    elizaLogger.error("Failed to fetch new contracts:", err);
                    return [];
                }),
                this.mcpClient.getTokenTransfers(undefined, 30).catch(err => {
                    elizaLogger.error("Failed to fetch token transfers:", err);
                    return [];
                })
            ];
            
            const [transactions, newContracts, tokenTransfers] = await Promise.all(fetchPromises);
            
            // Log fetch results
            elizaLogger.info(`Fetched data - Transactions: ${transactions.length}, Contracts: ${newContracts.length}, Transfers: ${tokenTransfers.length}`);
            
            // Analyze for insights
            const insights = [
                ...this.analyzer.analyzeTransactions(transactions),
                ...this.analyzer.analyzeNewContracts(newContracts),
                ...this.analyzer.analyzeTokenTransfers(tokenTransfers)
            ];
            
            // Filter to only high-quality insights
            const topInsights = this.analyzer.filterInsights(insights, 'high');
            
            if (topInsights.length === 0) {
                elizaLogger.info("No high-severity insights found in this cycle");
                return;
            }
            
            elizaLogger.info(`Found ${topInsights.length} high-quality insights`);
            
            // Post to Twitter (max 1 per cycle to avoid spam)
            const posted = await this.twitterService.postInsights(topInsights, 1);
            
            if (posted > 0) {
                elizaLogger.info(`Successfully posted ${posted} insight(s) to Twitter`);
                
                // Store metrics if available
                if (this.runtime.cacheManager) {
                    const metrics = {
                        timestamp: Date.now(),
                        insightsFound: topInsights.length,
                        tweetsPosted: posted,
                        isHealthy: this.isHealthy
                    };
                    await this.runtime.cacheManager.set(
                        `bnb-mcp-metrics-${Date.now()}`,
                        metrics
                    );
                }
            }
        } catch (error) {
            elizaLogger.error("Failed to check and post insights:", error);
            
            // Mark as unhealthy if we get repeated failures
            this.isHealthy = false;
            
            // Try to recover with a health check
            await this.performHealthCheck();
        }
    }
}

// Factory function to create the service
export const createScheduledInsightsService = (): Service => {
    return {
        name: "bnbMcpScheduledInsights",
        description: "Scheduled service for monitoring BNB Chain and posting insights to Twitter",
        
        async initialize(runtime: IAgentRuntime): Promise<void> {
            const service = new ScheduledInsightsService(runtime);
            await service.initialize();
            
            // Register the service instance for potential cleanup
            runtime.registerService(service);
        }
    };
};