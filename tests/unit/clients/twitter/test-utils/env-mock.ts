import { vi } from 'vitest';

/**
 * Stores the original process.env
 */
let originalEnv: NodeJS.ProcessEnv;

/**
 * Mock process.env for tests to prevent reading actual .env file
 */
export function mockProcessEnv(overrides: Record<string, string | undefined> = {}) {
    // Store original if not already stored
    if (!originalEnv) {
        originalEnv = { ...process.env };
    }

    // Create a new env object with only the overrides
    const mockEnv: Record<string, string | undefined> = {
        NODE_ENV: 'test',
        ...overrides
    };

    // Replace process.env
    process.env = mockEnv as NodeJS.ProcessEnv;
}

/**
 * Restore the original process.env
 */
export function restoreProcessEnv() {
    if (originalEnv) {
        process.env = originalEnv;
    }
}

/**
 * Setup environment mocks for Twitter tests
 * This provides default values that tests expect
 */
export function setupTwitterTestEnv(overrides: Record<string, string | undefined> = {}) {
    mockProcessEnv({
        // Default Twitter test environment
        TWITTER_DRY_RUN: 'false',
        TWITTER_POLL_INTERVAL: '120',
        POST_INTERVAL_MIN: '90',
        POST_INTERVAL_MAX: '180',
        TWITTER_SEARCH_ENABLE: 'false',
        TWITTER_TARGET_USERS: '',
        MAX_TWEET_LENGTH: '280',
        TWITTER_RETRY_LIMIT: '3',
        ENABLE_ACTION_PROCESSING: 'true',
        ACTION_INTERVAL: '5',
        POST_IMMEDIATELY: 'false',
        TWITTER_SPACES_ENABLE: 'false',
        MAX_ACTIONS_PROCESSING: '10',
        ACTION_TIMELINE_TYPE: 'foryou',
        ...overrides
    });
}