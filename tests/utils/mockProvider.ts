/**
 * Mock Provider Infrastructure for API Testing
 * This provides a standardized way to mock external API responses
 */

export interface MockAPIResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
  timestamp: number;
  headers?: Record<string, string>;
}

export interface MockProviderConfig {
  shouldFail: boolean;
  failureRate?: number; // 0-1, probability of failure
  latency?: number; // ms
  responses: Map<string, MockAPIResponse>;
}

export class MockProvider {
  private config: MockProviderConfig;
  private callCount: Map<string, number> = new Map();

  constructor(config: Partial<MockProviderConfig> = {}) {
    this.config = {
      shouldFail: false,
      failureRate: 0,
      latency: 0,
      responses: new Map(),
      ...config
    };
  }

  async request<T = any>(endpoint: string, options?: any): Promise<MockAPIResponse<T>> {
    // Track call count
    const count = (this.callCount.get(endpoint) || 0) + 1;
    this.callCount.set(endpoint, count);

    // Simulate latency
    if (this.config.latency) {
      await new Promise(resolve => setTimeout(resolve, this.config.latency));
    }

    // Check if should fail
    if (this.config.shouldFail || (this.config.failureRate && Math.random() < this.config.failureRate)) {
      return {
        status: 500,
        error: 'Mock API Error',
        timestamp: Date.now()
      };
    }

    // Return configured response or default
    const response = this.config.responses.get(endpoint);
    if (response) {
      return { ...response, timestamp: Date.now() };
    }

    // Default 404
    return {
      status: 404,
      error: 'Endpoint not found in mock',
      timestamp: Date.now()
    };
  }

  getCallCount(endpoint: string): number {
    return this.callCount.get(endpoint) || 0;
  }

  resetCallCounts(): void {
    this.callCount.clear();
  }

  setResponse(endpoint: string, response: MockAPIResponse): void {
    this.config.responses.set(endpoint, response);
  }
}

// Helper to create mock responses
export function createMockResponse<T>(data: T, status = 200): MockAPIResponse<T> {
  return {
    status,
    data,
    timestamp: Date.now()
  };
}

// Environment variable mocker
export class EnvironmentMocker {
  private originalEnv: Record<string, string | undefined> = {};

  mock(vars: Record<string, string | undefined>): void {
    Object.entries(vars).forEach(([key, value]) => {
      this.originalEnv[key] = process.env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }

  restore(): void {
    Object.entries(this.originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    this.originalEnv = {};
  }
}