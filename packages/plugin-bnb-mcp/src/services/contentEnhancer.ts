import { elizaLogger } from "@elizaos/core";

export class ContentEnhancer {
    private characterPhrases = {
        openers: [
            "anons,",
            "gm degens,",
            "listen up,",
            "quick alpha:",
            "breaking:",
            "on-chain update:",
            "whale watch:",
        ],
        
        transitions: [
            "here's the thing -",
            "let me explain -",
            "translation:",
            "what this means:",
            "tldr:",
            "context:",
        ],
        
        closers: [
            "dyor",
            "nfa",
            "probably nothing",
            "few understand",
            "stay based",
            "gn",
        ],
        
        reactions: {
            positive: ["bullish", "based", "gigabrain move", "smart money"],
            negative: ["bearish", "ngmi", "rekt incoming", "red flags"],
            neutral: ["interesting", "monitoring this", "taking notes", "eyes on"]
        }
    };

    /**
     * Enhance content with character personality
     */
    enhanceContent(content: string, sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'): string {
        // Don't enhance if already has personality markers
        if (this.hasPersonalityMarkers(content)) {
            return content;
        }

        let enhanced = content;

        // Add opener if missing
        if (!this.hasOpener(content)) {
            const opener = this.getRandomElement(this.characterPhrases.openers);
            enhanced = `${opener} ${enhanced}`;
        }

        // Add reaction based on sentiment
        enhanced = this.injectReaction(enhanced, sentiment);

        // Convert to lowercase sections for emphasis
        enhanced = this.addLowercaseEmphasis(enhanced);

        // Add closer if there's room
        if (enhanced.length < 220) {
            const closer = this.getRandomElement(this.characterPhrases.closers);
            enhanced = `${enhanced}\n\n${closer}`;
        }

        return enhanced;
    }

    /**
     * Check if content already has personality markers
     */
    private hasPersonalityMarkers(content: string): boolean {
        const markers = [
            'anon', 'degen', 'gm', 'gn', 'ser', 'fren',
            'based', 'ngmi', 'wagmi', 'wen', 'nfa', 'dyor',
            'probably nothing', 'few understand'
        ];
        
        const lowerContent = content.toLowerCase();
        return markers.some(marker => lowerContent.includes(marker));
    }

    /**
     * Check if content has an opener
     */
    private hasOpener(content: string): boolean {
        const lowerContent = content.toLowerCase();
        return this.characterPhrases.openers.some(opener => 
            lowerContent.startsWith(opener.toLowerCase())
        );
    }

    /**
     * Inject reaction based on sentiment
     */
    private injectReaction(content: string, sentiment: 'positive' | 'negative' | 'neutral'): string {
        const reactions = this.characterPhrases.reactions[sentiment];
        const reaction = this.getRandomElement(reactions);
        
        // Find a good place to inject
        const sentences = content.split(/(?<=[.!?])\s+/);
        if (sentences.length > 1) {
            // Insert after first sentence
            sentences.splice(1, 0, `${reaction}.`);
            return sentences.join(' ');
        }
        
        return content;
    }

    /**
     * Add lowercase emphasis to certain parts
     */
    private addLowercaseEmphasis(content: string): string {
        // Convert certain phrases to lowercase for emphasis
        const emphasisPhrases = [
            'PROBABLY NOTHING',
            'NOT FINANCIAL ADVICE',
            'DO YOUR OWN RESEARCH',
            'FEW UNDERSTAND'
        ];
        
        let result = content;
        emphasisPhrases.forEach(phrase => {
            const regex = new RegExp(phrase, 'gi');
            result = result.replace(regex, phrase.toLowerCase());
        });
        
        return result;
    }

    /**
     * Make content more sarcastic
     */
    makeSarcastic(content: string): string {
        const sarcasticReplacements: Record<string, string> = {
            'innovative': '"innovative"',
            'revolutionary': '"revolutionary"',
            'game-changing': '"game-changing"',
            'decentralized': '"decentralized"',
            'community-driven': '"community-driven"',
            'the future': 'the "future"',
            'next big thing': 'next "big thing"'
        };
        
        let result = content;
        Object.entries(sarcasticReplacements).forEach(([original, replacement]) => {
            const regex = new RegExp(original, 'gi');
            result = result.replace(regex, replacement);
        });
        
        return result;
    }

    /**
     * Add technical credibility
     */
    addTechnicalContext(content: string, data: any): string {
        const technicalAdditions: string[] = [];
        
        if (data.gasPrice) {
            technicalAdditions.push(`gas: ${data.gasPrice} gwei`);
        }
        
        if (data.blockNumber) {
            technicalAdditions.push(`block: ${data.blockNumber}`);
        }
        
        if (data.value && parseFloat(data.value) > 0) {
            technicalAdditions.push(`value: ${data.value} BNB`);
        }
        
        if (technicalAdditions.length > 0 && content.length < 200) {
            return `${content} (${technicalAdditions.join(', ')})`;
        }
        
        return content;
    }

    /**
     * Ensure variety in language
     */
    ensureVariety(content: string, recentContents: string[]): string {
        // Check for repeated patterns
        const commonPatterns = this.extractPatterns(content);
        
        for (const recent of recentContents) {
            const recentPatterns = this.extractPatterns(recent);
            const overlap = this.calculatePatternOverlap(commonPatterns, recentPatterns);
            
            if (overlap > 0.5) {
                // Too similar, vary the language
                return this.varyLanguage(content);
            }
        }
        
        return content;
    }

    /**
     * Extract linguistic patterns
     */
    private extractPatterns(content: string): Set<string> {
        const patterns = new Set<string>();
        
        // Extract 2-3 word phrases
        const words = content.toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
            patterns.add(`${words[i]} ${words[i + 1]}`);
            if (i < words.length - 2) {
                patterns.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
            }
        }
        
        return patterns;
    }

    /**
     * Calculate pattern overlap
     */
    private calculatePatternOverlap(patterns1: Set<string>, patterns2: Set<string>): number {
        const intersection = new Set([...patterns1].filter(x => patterns2.has(x)));
        const union = new Set([...patterns1, ...patterns2]);
        return intersection.size / union.size;
    }

    /**
     * Vary language to avoid repetition
     */
    private varyLanguage(content: string): string {
        const variations: Record<string, string[]> = {
            'large': ['massive', 'huge', 'significant', 'substantial'],
            'transfer': ['movement', 'transaction', 'flow'],
            'whale': ['big player', 'major holder', 'smart money'],
            'new': ['fresh', 'just deployed', 'recently launched'],
            'contract': ['smart contract', 'protocol', 'dapp']
        };
        
        let varied = content;
        Object.entries(variations).forEach(([word, alternatives]) => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (regex.test(varied)) {
                const alternative = this.getRandomElement(alternatives);
                varied = varied.replace(regex, alternative);
            }
        });
        
        return varied;
    }

    /**
     * Get random element from array
     */
    private getRandomElement<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }
}