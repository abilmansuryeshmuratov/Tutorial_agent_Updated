import { describe, it, expect, beforeAll } from 'vitest';
import { createPublicClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { bsc } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('BNB Blockchain Real API Integration Tests', () => {
    let publicClient: any;
    const rpcUrl = process.env.BSC_PROVIDER_URL || process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';

    beforeAll(() => {
        // Initialize Viem client for BSC
        publicClient = createPublicClient({
            chain: bsc,
            transport: http(rpcUrl)
        });

        console.log('Using RPC URL:', rpcUrl);
    });

    describe('Chain Information', () => {
        it('should get current block number', async () => {
            try {
                const blockNumber = await publicClient.getBlockNumber();
                
                expect(blockNumber).toBeDefined();
                expect(blockNumber).toBeGreaterThan(0n);
                
                console.log('Current block number:', blockNumber.toString());
            } catch (error: any) {
                console.error('Block number error:', error);
                throw error;
            }
        }, 30000);

        it('should get chain ID', async () => {
            try {
                const chainId = await publicClient.getChainId();
                
                expect(chainId).toBe(56); // BSC mainnet chain ID
                
                console.log('Chain ID:', chainId);
            } catch (error: any) {
                console.error('Chain ID error:', error);
                throw error;
            }
        }, 30000);

        it('should get gas price', async () => {
            try {
                const gasPrice = await publicClient.getGasPrice();
                
                expect(gasPrice).toBeDefined();
                expect(gasPrice).toBeGreaterThan(0n);
                
                console.log('Current gas price:', {
                    wei: gasPrice.toString(),
                    gwei: (Number(gasPrice) / 1e9).toFixed(2)
                });
            } catch (error: any) {
                console.error('Gas price error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Block Analysis', () => {
        it('should analyze recent blocks for large transactions', async () => {
            try {
                const latestBlock = await publicClient.getBlock({ includeTransactions: true });
                
                expect(latestBlock).toBeDefined();
                expect(latestBlock.transactions).toBeDefined();
                
                // Find large transactions (> 100 BNB)
                const largeThreshold = parseEther('100');
                const largeTxs = latestBlock.transactions.filter((tx: any) => 
                    tx.value > largeThreshold
                );

                console.log('Latest block analysis:', {
                    blockNumber: latestBlock.number?.toString(),
                    totalTxs: latestBlock.transactions.length,
                    largeTxs: largeTxs.length,
                    gasUsed: latestBlock.gasUsed?.toString(),
                    baseFeePerGas: latestBlock.baseFeePerGas?.toString()
                });

                // Log details of large transactions
                largeTxs.slice(0, 3).forEach((tx: any) => {
                    console.log('Large transaction:', {
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        value: formatEther(tx.value) + ' BNB',
                        gasPrice: (Number(tx.gasPrice) / 1e9).toFixed(2) + ' gwei'
                    });
                });
            } catch (error: any) {
                console.error('Block analysis error:', error);
                throw error;
            }
        }, 30000);

        it('should check for MEV activity patterns', async () => {
            try {
                const latestBlocks = await Promise.all(
                    Array.from({ length: 3 }, async (_, i) => {
                        const blockNumber = await publicClient.getBlockNumber();
                        return publicClient.getBlock({ 
                            blockNumber: blockNumber - BigInt(i),
                            includeTransactions: true 
                        });
                    })
                );

                // Analyze for sandwich attacks (same sender in multiple positions)
                const mevPatterns = latestBlocks.map(block => {
                    const senderCounts: Record<string, number> = {};
                    block.transactions.forEach((tx: any) => {
                        senderCounts[tx.from] = (senderCounts[tx.from] || 0) + 1;
                    });

                    const suspiciousSenders = Object.entries(senderCounts)
                        .filter(([_, count]) => count > 2)
                        .map(([sender, count]) => ({ sender, count }));

                    return {
                        block: block.number?.toString(),
                        suspiciousSenders
                    };
                });

                console.log('MEV activity analysis:', mevPatterns);
            } catch (error: any) {
                console.error('MEV analysis error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Token Operations', () => {
        it('should get BNB balance of a known address', async () => {
            try {
                // Binance Hot Wallet address (example)
                const address = '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3';
                const balance = await publicClient.getBalance({ address });
                
                expect(balance).toBeDefined();
                
                console.log('BNB balance:', {
                    address,
                    wei: balance.toString(),
                    bnb: formatEther(balance)
                });
            } catch (error: any) {
                console.error('Balance check error:', error);
                throw error;
            }
        }, 30000);

        it('should check BUSD token information', async () => {
            try {
                // BUSD token contract address
                const busdAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
                
                // ERC20 ABI for basic functions
                const erc20Abi = parseAbi([
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function decimals() view returns (uint8)',
                    'function totalSupply() view returns (uint256)',
                    'function balanceOf(address) view returns (uint256)'
                ]);

                const [name, symbol, decimals, totalSupply] = await Promise.all([
                    publicClient.readContract({
                        address: busdAddress,
                        abi: erc20Abi,
                        functionName: 'name'
                    }),
                    publicClient.readContract({
                        address: busdAddress,
                        abi: erc20Abi,
                        functionName: 'symbol'
                    }),
                    publicClient.readContract({
                        address: busdAddress,
                        abi: erc20Abi,
                        functionName: 'decimals'
                    }),
                    publicClient.readContract({
                        address: busdAddress,
                        abi: erc20Abi,
                        functionName: 'totalSupply'
                    })
                ]);

                console.log('BUSD Token Info:', {
                    name,
                    symbol,
                    decimals,
                    totalSupply: (Number(totalSupply) / 10 ** Number(decimals)).toLocaleString()
                });

                expect(symbol).toBe('BUSD');
                expect(decimals).toBe(18);
            } catch (error: any) {
                console.error('Token info error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Smart Contract Detection', () => {
        it('should detect new contract deployments', async () => {
            try {
                const latestBlock = await publicClient.getBlockNumber();
                const receipts = await publicClient.getBlockReceipts({ 
                    blockNumber: latestBlock 
                });

                const contractDeployments = receipts.filter((receipt: any) => 
                    receipt.contractAddress !== null
                );

                console.log('Contract deployments in latest block:', {
                    blockNumber: latestBlock.toString(),
                    totalDeployments: contractDeployments.length,
                    contracts: contractDeployments.slice(0, 5).map((r: any) => ({
                        address: r.contractAddress,
                        deployer: r.from,
                        gasUsed: r.gasUsed?.toString()
                    }))
                });

                expect(receipts).toBeDefined();
            } catch (error: any) {
                console.error('Contract detection error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('DeFi Activity', () => {
        it('should check PancakeSwap router activity', async () => {
            try {
                // PancakeSwap V2 Router address
                const routerAddress = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
                
                // Get recent transactions to the router
                const latestBlock = await publicClient.getBlock({ includeTransactions: true });
                const routerTxs = latestBlock.transactions.filter((tx: any) => 
                    tx.to?.toLowerCase() === routerAddress.toLowerCase()
                );

                console.log('PancakeSwap activity:', {
                    blockNumber: latestBlock.number?.toString(),
                    routerTransactions: routerTxs.length,
                    totalBlockTxs: latestBlock.transactions.length,
                    percentage: ((routerTxs.length / latestBlock.transactions.length) * 100).toFixed(2) + '%'
                });

                // Analyze swap values
                if (routerTxs.length > 0) {
                    const swapValues = routerTxs.map((tx: any) => formatEther(tx.value));
                    console.log('Sample swap values (BNB):', swapValues.slice(0, 5));
                }
            } catch (error: any) {
                console.error('DeFi activity error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Network Health', () => {
        it('should check network sync status', async () => {
            try {
                const [blockNumber, block, gasPrice] = await Promise.all([
                    publicClient.getBlockNumber(),
                    publicClient.getBlock(),
                    publicClient.getGasPrice()
                ]);

                const timeSinceBlock = Date.now() / 1000 - Number(block.timestamp);
                
                console.log('Network health:', {
                    currentBlock: blockNumber.toString(),
                    blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
                    secondsSinceLastBlock: timeSinceBlock.toFixed(0),
                    gasPrice: (Number(gasPrice) / 1e9).toFixed(2) + ' gwei',
                    isHealthy: timeSinceBlock < 10 // BSC has ~3s block time
                });

                expect(timeSinceBlock).toBeLessThan(60); // Should have recent blocks
            } catch (error: any) {
                console.error('Network health error:', error);
                throw error;
            }
        }, 30000);

        it('should test RPC rate limits', async () => {
            try {
                // Make multiple rapid requests to test rate limits
                const requests = Array.from({ length: 10 }, () => 
                    publicClient.getGasPrice()
                );

                const startTime = Date.now();
                const results = await Promise.allSettled(requests);
                const endTime = Date.now();

                const successful = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;

                console.log('Rate limit test:', {
                    totalRequests: requests.length,
                    successful,
                    failed,
                    duration: `${endTime - startTime}ms`,
                    avgRequestTime: `${(endTime - startTime) / requests.length}ms`
                });

                expect(successful).toBeGreaterThan(0);
            } catch (error: any) {
                console.error('Rate limit test error:', error);
                throw error;
            }
        }, 30000);
    });

    describe('Historical Data', () => {
        it('should fetch historical block data', async () => {
            try {
                const currentBlock = await publicClient.getBlockNumber();
                const blocksToCheck = 5;
                
                const historicalBlocks = await Promise.all(
                    Array.from({ length: blocksToCheck }, async (_, i) => {
                        const blockNumber = currentBlock - BigInt(i * 100);
                        const block = await publicClient.getBlock({ blockNumber });
                        return {
                            number: block.number?.toString(),
                            timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                            transactions: block.transactions.length,
                            gasUsed: block.gasUsed?.toString()
                        };
                    })
                );

                console.log('Historical blocks analysis:', historicalBlocks);

                // Calculate average transactions per block
                const avgTxs = historicalBlocks.reduce((sum, b) => sum + b.transactions, 0) / blocksToCheck;
                console.log(`Average transactions per block: ${avgTxs.toFixed(2)}`);

                expect(historicalBlocks.length).toBe(blocksToCheck);
            } catch (error: any) {
                console.error('Historical data error:', error);
                throw error;
            }
        }, 30000);
    });
});