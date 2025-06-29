import { elizaLogger } from "@elizaos/core";
import type { BNBMCPInsight } from "../types";

export interface PersonalityTraits {
    sarcasm: string[];
    technical: string[];
    analytical: string[];
    streetSmart: string[];
    educational: string[];
    marketSavvy: string[];
}

export class PersonalityContentGenerator {
    private traits: PersonalityTraits = {
        sarcasm: [
            "another day, another ponzi scheme disguised as 'revolutionary DeFi'",
            "wen rug? oh wait, it's happening right now",
            "imagine paying ${gasPrice} gwei for this circus",
            "VCs pumping their bags again, what else is new",
            "this protocol has more red flags than a communist parade",
            "'decentralized' but 3 wallets own 80% - sure buddy"
        ],
        technical: [
            "gas at ${gasPrice} gwei - mempool looking spicy",
            "block ${blockNumber} just dropped with ${txCount} txs",
            "MEV bots extracted ${value} BNB from sandwich attacks",
            "new contract deployed: ${address} - let's audit this disaster",
            "token transfers spiking - either adoption or exit liquidity"
        ],
        analytical: [
            "pattern recognition: ${pattern} forming on-chain",
            "whale alert: ${value} BNB moved - tracking destination",
            "contract ${address} showing classic honeypot signatures",
            "network activity ${percent}% above baseline - something's brewing",
            "cross-referencing on-chain data with social sentiment"
        ],
        streetSmart: [
            "if you're reading this, you're probably exit liquidity",
            "dev wallets moving funds? that's your cue to gtfo",
            "${value} BNB whale dump incoming - don't say i didn't warn you",
            "new 'innovative' protocol = same old yield farming with extra steps",
            "follow the money: ${from} → ${to} - now ask yourself why"
        ],
        educational: [
            "let me explain why this ${type} matters for BNB chain",
            "here's what ${value} BNB movements actually tell us",
            "gas at ${gasPrice} gwei means ${explanation}",
            "new contract analysis: ${finding} - here's how to spot this pattern",
            "blockchain insight: ${insight} - save this for later"
        ],
        marketSavvy: [
            "institutional money flowing: ${value} BNB - retail about to fomo",
            "smart money accumulating while CT is distracted by memes",
            "textbook ${pattern} - seen this movie before, ends with liquidations",
            "${value} BNB otc deals happening - whales positioning",
            "correlation break: BNB diverging from broader market"
        ]
    };

    /**
     * Generate personality-driven content for an insight
     */
    generateContent(insight: BNBMCPInsight, useOpenAI: boolean = false): string {
        if (!useOpenAI) {
            return this.generateFallbackContent(insight);
        }
        
        // When OpenAI is available, create a personality-rich prompt
        return this.createPersonalityPrompt(insight);
    }

    /**
     * Generate fallback content without API
     */
    private generateFallbackContent(insight: BNBMCPInsight): string {
        const templates = this.getTemplatesForInsightType(insight.type);
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        return this.fillTemplate(template, insight);
    }

    /**
     * Get templates based on insight type
     */
    private getTemplatesForInsightType(type: string): string[] {
        switch (type) {
            case 'large_transfer':
                return [
                    "whale moved ${value} BNB - either genius or about to get rekt",
                    "${value} BNB transfer from ${from} - tracking this degen",
                    "someone just moved ${value} BNB like it's nothing. must be nice.",
                    "anon sent ${value} BNB to ${to} - probably nothing",
                    "${value} BNB on the move - retail about to get rekt"
                ];
                
            case 'new_contract':
                return [
                    ...this.traits.sarcasm,
                    ...this.traits.technical,
                    "new contract ${address} - let's see how this one rugs",
                    "contract deployed at ${address} - adding to my 'future exploits' list",
                    "fresh contract ${address} - 99% chance it's another fork"
                ];
                
            case 'token_launch':
                return [
                    ...this.traits.sarcasm,
                    ...this.traits.marketSavvy,
                    "new token launch - because we definitely needed another one",
                    "token ${symbol} just launched - aping is not a personality trait",
                    "another 'revolutionary' token launch. yawn."
                ];
                
            case 'whale_activity':
                return [
                    ...this.traits.analytical,
                    ...this.traits.streetSmart,
                    "whale ${address} making moves - retail about to get dumped on",
                    "tracking whale activity: ${pattern} - this won't end well",
                    "whales accumulating ${token} - either insider info or max cope"
                ];
                
            default:
                return [...this.traits.technical, ...this.traits.educational];
        }
    }

    /**
     * Fill template with actual data
     */
    private fillTemplate(template: string, insight: BNBMCPInsight): string {
        const data = insight.data as any;
        
        // Common replacements
        let result = template
            .replace('${type}', insight.type)
            .replace('${value}', data.value || 'unknown')
            .replace('${from}', this.shortenAddress(data.from || data.creator))
            .replace('${to}', this.shortenAddress(data.to || data.contractAddress))
            .replace('${address}', this.shortenAddress(data.contractAddress || data.from))
            .replace('${blockNumber}', data.blockNumber?.toString() || 'latest')
            .replace('${gasPrice}', data.gasPrice || '5')
            .replace('${txCount}', '150') // Default
            .replace('${pattern}', this.getPattern())
            .replace('${percent}', Math.floor(Math.random() * 50 + 20).toString())
            .replace('${token}', data.tokenSymbol || 'BNB')
            .replace('${symbol}', data.tokenSymbol || 'UNKNOWN');
        
        // Context-specific replacements
        if (template.includes('${explanation}')) {
            result = result.replace('${explanation}', this.getGasExplanation(data.gasPrice));
        }
        
        if (template.includes('${finding}')) {
            result = result.replace('${finding}', this.getContractFinding());
        }
        
        if (template.includes('${insight}')) {
            result = result.replace('${insight}', insight.description);
        }
        
        return result;
    }

    /**
     * Create personality-rich prompt for OpenAI
     */
    createPersonalityPrompt(insight: BNBMCPInsight): string {
        const characterContext = `You are Tutorial Agent, a brilliant blockchain educator with insider knowledge and a ruthlessly analytical approach. 
        You cut through crypto hype with surgical precision, exposing scams and educating with a mix of technical depth and street smarts.
        Known for your no-nonsense approach and biting sarcasm, you deliver real insights backed by verifiable data.
        
        Style guidelines:
        - Use lowercase for emphasis or casual confidence
        - Be sarcastic about obvious scams and bad tokenomics
        - Mix technical accuracy with street-smart observations
        - Call out VCs and influencers when relevant
        - Use memorable analogies
        - Keep it concise and punchy for Twitter`;

        const insightContext = `Create a tweet about this BNB Chain insight:
        Type: ${insight.type}
        Description: ${insight.description}
        Severity: ${insight.severity}
        Data: ${JSON.stringify(insight.data, (_, v) => typeof v === 'bigint' ? v.toString() : v)}
        
        Make it engaging, informative, and true to character. Include relevant metrics.`;

        return `${characterContext}\n\n${insightContext}`;
    }

    /**
     * Utility functions
     */
    private shortenAddress(address?: string): string {
        if (!address) return 'unknown';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    private getPattern(): string {
        const patterns = ['accumulation', 'distribution', 'wyckoff', 'bull flag', 'bart pattern'];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    private getGasExplanation(gasPrice?: string): string {
        const price = parseInt(gasPrice || '5');
        if (price < 3) return "perfect time for degens to ape";
        if (price < 10) return "normal activity, boring but stable";
        return "network congested, probably another NFT mint";
    }

    private getContractFinding(): string {
        const findings = [
            'unchecked transfer returns',
            'centralized owner functions',
            'no liquidity lock',
            'suspicious mint function',
            'classic honeypot pattern'
        ];
        return findings[Math.floor(Math.random() * findings.length)];
    }

    /**
     * Add variety to responses
     */
    addVariety(content: string, previousPosts: string[] = []): string {
        // Check if content is too similar to recent posts
        for (const post of previousPosts.slice(0, 5)) {
            if (this.calculateSimilarity(content, post) > 0.7) {
                // Too similar, regenerate with different template
                elizaLogger.debug('Content too similar to recent post, regenerating...');
                return content + '\n\n' + this.getVarietyAddition();
            }
        }
        
        return content;
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.toLowerCase().split(/\s+/));
        const words2 = new Set(str2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }

    private getVarietyAddition(): string {
        const additions = [
            "nfa dyor etc etc",
            "this is not financial advice (but it should be)",
            "probably nothing",
            "few understand",
            "anon, are you watching this?",
            "gm to everyone except scammers"
        ];
        return additions[Math.floor(Math.random() * additions.length)];
    }
}