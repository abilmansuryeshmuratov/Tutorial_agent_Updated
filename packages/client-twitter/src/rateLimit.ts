import { elizaLogger } from "@elizaos/core";

export interface RateLimitInfo {
    endpoint: string;
    remaining: number;
    limit: number;
    reset: number; // Unix timestamp in seconds
    retryAfter?: number; // Seconds to wait (from Retry-After header)
}

export interface RateLimitTracker {
    [endpoint: string]: RateLimitInfo;
}

export class RateLimitHandler {
    private rateLimits: RateLimitTracker = {};
    private readonly SAFETY_MARGIN = 5; // Keep 5 requests as safety margin
    private readonly DEFAULT_RETRY_AFTER = 60; // Default wait time in seconds

    /**
     * Check if we should wait before making a request
     */
    shouldWait(endpoint: string): { wait: boolean; waitTime?: number } {
        const info = this.rateLimits[endpoint];
        if (!info) return { wait: false };

        const now = Date.now() / 1000; // Current time in seconds
        
        // If we're past the reset time, clear the limit
        if (now >= info.reset) {
            delete this.rateLimits[endpoint];
            return { wait: false };
        }

        // If we have a retry-after time and it's still active
        if (info.retryAfter && now < info.reset) {
            const waitTime = Math.ceil(info.reset - now);
            return { wait: true, waitTime };
        }

        // If we're approaching the rate limit
        if (info.remaining <= this.SAFETY_MARGIN) {
            const waitTime = Math.ceil(info.reset - now);
            elizaLogger.warn(`Rate limit approaching for ${endpoint}: ${info.remaining}/${info.limit} remaining. Waiting ${waitTime}s`);
            return { wait: true, waitTime };
        }

        return { wait: false };
    }

    /**
     * Update rate limit info from response headers
     */
    updateFromHeaders(endpoint: string, headers: any) {
        try {
            const limit = parseInt(headers['x-rate-limit-limit'] || headers['x-ratelimit-limit'] || '0');
            const remaining = parseInt(headers['x-rate-limit-remaining'] || headers['x-ratelimit-remaining'] || '0');
            const reset = parseInt(headers['x-rate-limit-reset'] || headers['x-ratelimit-reset'] || '0');

            if (limit && reset) {
                this.rateLimits[endpoint] = {
                    endpoint,
                    limit,
                    remaining: remaining || 0,
                    reset
                };
                
                elizaLogger.debug(`Rate limit updated for ${endpoint}: ${remaining}/${limit}, resets at ${new Date(reset * 1000).toISOString()}`);
            }
        } catch (error) {
            elizaLogger.error('Error parsing rate limit headers:', error);
        }
    }

    /**
     * Handle rate limit error (429 response)
     */
    handleRateLimitError(endpoint: string, error: any): number {
        let waitTime = this.DEFAULT_RETRY_AFTER;

        // Try to get retry-after from error response
        if (error.response) {
            const retryAfter = error.response.headers?.['retry-after'];
            if (retryAfter) {
                waitTime = parseInt(retryAfter);
                if (isNaN(waitTime)) {
                    // If it's a date string, calculate seconds until then
                    const retryDate = new Date(retryAfter);
                    waitTime = Math.ceil((retryDate.getTime() - Date.now()) / 1000);
                }
            }

            // Also try to get rate limit headers from error response
            this.updateFromHeaders(endpoint, error.response.headers || {});
        }

        // For Twitter API v2 errors
        if (error.rateLimit) {
            const reset = error.rateLimit.reset;
            if (reset) {
                waitTime = Math.ceil(reset - Date.now() / 1000);
                this.rateLimits[endpoint] = {
                    endpoint,
                    limit: error.rateLimit.limit || 0,
                    remaining: 0,
                    reset,
                    retryAfter: waitTime
                };
            }
        }

        elizaLogger.warn(`Rate limit hit for ${endpoint}. Waiting ${waitTime} seconds before retry.`);
        return Math.max(waitTime, 1); // Ensure at least 1 second wait
    }

    /**
     * Wait if necessary before making a request
     */
    async waitIfNeeded(endpoint: string): Promise<void> {
        const { wait, waitTime } = this.shouldWait(endpoint);
        if (wait && waitTime) {
            elizaLogger.info(`Waiting ${waitTime}s due to rate limit for ${endpoint}`);
            await this.sleep(waitTime * 1000);
        }
    }

    /**
     * Get current rate limit status for an endpoint
     */
    getStatus(endpoint: string): RateLimitInfo | null {
        return this.rateLimits[endpoint] || null;
    }

    /**
     * Get all rate limit statuses
     */
    getAllStatuses(): RateLimitTracker {
        // Clean up expired entries
        const now = Date.now() / 1000;
        Object.keys(this.rateLimits).forEach(endpoint => {
            if (this.rateLimits[endpoint].reset < now) {
                delete this.rateLimits[endpoint];
            }
        });
        return { ...this.rateLimits };
    }

    /**
     * Clear rate limit info for an endpoint
     */
    clearEndpoint(endpoint: string) {
        delete this.rateLimits[endpoint];
    }

    /**
     * Clear all rate limit info
     */
    clearAll() {
        this.rateLimits = {};
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const rateLimitHandler = new RateLimitHandler();

// Helper function to extract endpoint from URL or operation
export function getEndpointKey(operation: string): string {
    // Normalize common Twitter API endpoints
    const endpointMap: { [key: string]: string } = {
        'tweets': 'tweets',
        'users': 'users',
        'search': 'search',
        'timeline': 'timeline',
        'mentions': 'mentions',
        'likes': 'likes',
        'retweets': 'retweets',
        'followers': 'followers',
        'following': 'following'
    };

    // Try to match operation to known endpoints
    for (const [key, value] of Object.entries(endpointMap)) {
        if (operation.toLowerCase().includes(key)) {
            return value;
        }
    }

    return operation; // Return as-is if no match
}

// Error detection helper
export function isRateLimitError(error: any): boolean {
    // Check various ways rate limit errors can be indicated
    return (
        error.code === 429 ||
        error.status === 429 ||
        error.response?.status === 429 ||
        error.response?.statusCode === 429 ||
        error.message?.toLowerCase().includes('rate limit') ||
        error.message?.toLowerCase().includes('too many requests') ||
        error.error?.toLowerCase().includes('rate limit') ||
        !!error.rateLimit
    );
}