import { elizaLogger } from "@elizaos/core";
import { createPublicClient, http, formatEther, type Address, type Hash } from "viem";
import { bsc } from "viem/chains";
import type { BNBMCPTransaction, BNBMCPTokenTransfer, BNBMCPContractCreation, MCPClientConfig } from "../types";

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export class BNBMCPClient {
    private client;
    private config: MCPClientConfig;
    private defaultBlockRange: number;
    private retryAttempts: number;
    private cache: Map<string, CacheEntry<any>>;
    private cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
    
    constructor(config?: MCPClientConfig) {
        this.config = config || { env: {} };
        
        // Get block range from env or use default
        this.defaultBlockRange = parseInt(config?.env?.RPC_BLOCK_RANGE || '100');
        if (isNaN(this.defaultBlockRange) || this.defaultBlockRange < 1) {
            this.defaultBlockRange = 100;
        }
        
        // Get retry attempts from env or config
        this.retryAttempts = parseInt(config?.env?.RPC_RETRY_ATTEMPTS || '') || 
                           config?.retryAttempts || 3;
        
        // Initialize cache
        this.cache = new Map();
        this.cacheTTL = parseInt(config?.env?.RPC_CACHE_TTL || '') || this.cacheTTL;
        
        // Initialize viem client for BSC
        this.client = createPublicClient({
            chain: bsc,
            transport: http(config?.env?.RPC_URL || 'https://bsc-dataseed.binance.org/'),
        });
        
        elizaLogger.info(`BNB MCP Client initialized with block range: ${this.defaultBlockRange}, retry attempts: ${this.retryAttempts}, cache TTL: ${this.cacheTTL}ms`);
        
        // Schedule cache cleanup every minute
        setInterval(() => this.cleanupCache(), 60 * 1000);
    }

    /**
     * Convert Wei to BNB string
     */
    private weiToBNB(wei: bigint): string {
        return formatEther(wei);
    }
    
    /**
     * Get data from cache if valid
     */
    private getFromCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        const age = Date.now() - entry.timestamp;
        if (age > this.cacheTTL) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data as T;
    }
    
    /**
     * Store data in cache
     */
    private setCache<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Clean up expired cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.cacheTTL) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            elizaLogger.debug(`Cleaned ${cleaned} expired cache entries`);
        }
    }

    /**
     * Retry wrapper for RPC calls
     */
    private async retryRpcCall<T>(
        operation: () => Promise<T>,
        operationName: string,
        retries?: number
    ): Promise<T | null> {
        const maxRetries = retries || this.retryAttempts;
        const delays = [1000, 2000, 4000]; // Exponential backoff
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                const isLastAttempt = attempt === maxRetries - 1;
                const isRateLimitError = error.message?.includes('limit') || 
                                       error.message?.includes('rate') ||
                                       error.code === -32005;
                
                if (isRateLimitError && !isLastAttempt) {
                    const delay = delays[attempt] || 4000;
                    elizaLogger.warn(
                        `RPC rate limit hit for ${operationName}, attempt ${attempt + 1}/${maxRetries}. Retrying in ${delay}ms...`
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else if (isLastAttempt) {
                    elizaLogger.error(`Failed ${operationName} after ${maxRetries} attempts:`, error);
                    return null;
                } else if (!isRateLimitError) {
                    // For non-rate-limit errors, log and return null immediately
                    elizaLogger.error(`Failed ${operationName} with non-retryable error:`, error);
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Fetch recent large transactions
     */
    async getLargeTransactions(minValue: string = "100", limit: number = 10): Promise<BNBMCPTransaction[]> {
        try {
            // Get latest block
            const latestBlock = await this.client.getBlockNumber();
            const fromBlock = latestBlock - 100n; // Check last 100 blocks
            
            // Get recent blocks and their transactions
            const transactions: BNBMCPTransaction[] = [];
            const minValueWei = BigInt(minValue) * 10n ** 18n;
            
            for (let i = 0; i < 5 && transactions.length < limit; i++) {
                const block = await this.client.getBlock({
                    blockNumber: latestBlock - BigInt(i),
                    includeTransactions: true
                });
                
                for (const tx of block.transactions) {
                    if (tx.value && tx.value >= minValueWei) {
                        transactions.push({
                            hash: tx.hash,
                            from: tx.from,
                            to: tx.to || '0x0',
                            value: this.weiToBNB(tx.value),
                            blockNumber: Number(block.number),
                            timestamp: Number(block.timestamp),
                            gasUsed: '0', // Will be updated when tx receipt is available
                            gasPrice: tx.gasPrice ? this.weiToBNB(tx.gasPrice) : '0'
                        });
                        
                        if (transactions.length >= limit) break;
                    }
                }
            }
            
            return transactions;
        } catch (error) {
            elizaLogger.error("Failed to get large transactions:", error);
            return [];
        }
    }

    /**
     * Fetch recent token transfers
     */
    async getTokenTransfers(tokenAddress?: string, limit: number = 20): Promise<BNBMCPTokenTransfer[]> {
        const operation = async () => {
            // Get latest block
            const latestBlock = await this.client.getBlockNumber();
            const fromBlock = latestBlock - BigInt(this.defaultBlockRange); // Use configurable block range
            
            // ERC20 Transfer event signature
            const transferEventSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
            
            // Get transfer logs
            const logs = await this.client.getLogs({
                address: tokenAddress as Address,
                event: {
                    name: 'Transfer',
                    inputs: [
                        { name: 'from', type: 'address', indexed: true },
                        { name: 'to', type: 'address', indexed: true },
                        { name: 'value', type: 'uint256', indexed: false }
                    ],
                    type: 'event'
                },
                fromBlock,
                toBlock: latestBlock
            });
            
            // Convert logs to token transfers
            const transfers: BNBMCPTokenTransfer[] = logs.slice(0, limit).map(log => ({
                hash: log.transactionHash,
                tokenAddress: log.address,
                from: log.args.from as string,
                to: log.args.to as string,
                value: log.args.value.toString(),
                tokenSymbol: 'Unknown', // Would need token contract call to get this
                tokenName: 'Unknown',
                blockNumber: Number(log.blockNumber),
                timestamp: Date.now() // Would need block info for exact timestamp
            }));
            
            return transfers;
        };
        
        const result = await this.retryRpcCall(operation, 'getTokenTransfers');
        return result || [];
    }

    /**
     * Fetch new contract deployments
     */
    async getNewContracts(blockRange: number = 100): Promise<BNBMCPContractCreation[]> {
        try {
            // Get latest block
            const latestBlock = await this.client.getBlockNumber();
            const fromBlock = latestBlock - BigInt(blockRange);
            
            const contracts: BNBMCPContractCreation[] = [];
            
            // Check recent blocks for contract creations
            for (let i = 0; i < Math.min(blockRange, 10); i++) {
                const block = await this.client.getBlock({
                    blockNumber: latestBlock - BigInt(i),
                    includeTransactions: true
                });
                
                for (const tx of block.transactions) {
                    // Contract creation has no 'to' address
                    if (!tx.to && tx.input && tx.input.length > 2) {
                        // Calculate contract address
                        const receipt = await this.client.getTransactionReceipt({
                            hash: tx.hash
                        });
                        
                        if (receipt && receipt.contractAddress) {
                            contracts.push({
                                hash: tx.hash,
                                creator: tx.from,
                                contractAddress: receipt.contractAddress,
                                blockNumber: Number(block.number),
                                timestamp: Number(block.timestamp),
                                gasUsed: receipt.gasUsed.toString()
                            });
                        }
                    }
                }
            }
            
            return contracts;
        } catch (error) {
            elizaLogger.error("Failed to get new contracts:", error);
            return [];
        }
    }

    /**
     * Get current gas price
     */
    async getGasPrice(): Promise<string> {
        const cacheKey = 'gasPrice';
        
        // Check cache first
        const cached = this.getFromCache<string>(cacheKey);
        if (cached) {
            elizaLogger.debug('Gas price served from cache');
            return cached;
        }
        
        const operation = async () => {
            const gasPrice = await this.client.getGasPrice();
            return this.weiToBNB(gasPrice);
        };
        
        const result = await this.retryRpcCall(operation, 'getGasPrice');
        
        if (result && result !== "0") {
            this.setCache(cacheKey, result);
        }
        
        return result || "0";
    }

    /**
     * Get token balance for an address
     */
    async getTokenBalance(address: string, tokenAddress?: string): Promise<string> {
        const cacheKey = `balance:${address}:${tokenAddress || 'BNB'}`;
        
        // Check cache first
        const cached = this.getFromCache<string>(cacheKey);
        if (cached) {
            elizaLogger.debug(`Balance for ${address} served from cache`);
            return cached;
        }
        
        const operation = async () => {
            if (!tokenAddress) {
                // Get BNB balance
                const balance = await this.client.getBalance({
                    address: address as Address
                });
                return this.weiToBNB(balance);
            } else {
                // Get ERC20 token balance
                const balanceResult = await this.client.readContract({
                    address: tokenAddress as Address,
                    abi: [
                        {
                            name: 'balanceOf',
                            type: 'function',
                            stateMutability: 'view',
                            inputs: [{ name: 'account', type: 'address' }],
                            outputs: [{ name: 'balance', type: 'uint256' }]
                        }
                    ],
                    functionName: 'balanceOf',
                    args: [address as Address]
                });
                
                return balanceResult.toString();
            }
        };
        
        const result = await this.retryRpcCall(operation, 'getTokenBalance');
        
        if (result && result !== "0") {
            this.setCache(cacheKey, result);
        }
        
        return result || "0";
    }
}