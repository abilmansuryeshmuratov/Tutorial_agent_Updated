/**
 * OpenAI Moderation API Mock Data
 */

export interface ModerationCategory {
  hate: boolean;
  'hate/threatening': boolean;
  harassment: boolean;
  'harassment/threatening': boolean;
  'self-harm': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  sexual: boolean;
  'sexual/minors': boolean;
  violence: boolean;
  'violence/graphic': boolean;
}

export interface ModerationCategoryScores {
  hate: number;
  'hate/threatening': number;
  harassment: number;
  'harassment/threatening': number;
  'self-harm': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  sexual: number;
  'sexual/minors': number;
  violence: number;
  'violence/graphic': number;
}

export const mockOpenAIResponses = {
  // Clean content
  cleanContent: {
    id: 'modr-9XcKLnTGqXH8GJgJMBhcn',
    model: 'text-moderation-007',
    results: [{
      categories: {
        'hate': false,
        'hate/threatening': false,
        'harassment': false,
        'harassment/threatening': false,
        'self-harm': false,
        'self-harm/intent': false,
        'self-harm/instructions': false,
        'sexual': false,
        'sexual/minors': false,
        'violence': false,
        'violence/graphic': false
      },
      category_scores: {
        'hate': 0.001,
        'hate/threatening': 0.0001,
        'harassment': 0.002,
        'harassment/threatening': 0.0001,
        'self-harm': 0.0001,
        'self-harm/intent': 0.00001,
        'self-harm/instructions': 0.00001,
        'sexual': 0.001,
        'sexual/minors': 0.0001,
        'violence': 0.002,
        'violence/graphic': 0.0001
      },
      flagged: false
    }]
  },

  // Borderline content (around threshold)
  borderlineContent: {
    id: 'modr-9XcKLnTGqXH8GJgJMBhcn',
    model: 'text-moderation-007',
    results: [{
      categories: {
        'hate': false,
        'hate/threatening': false,
        'harassment': true,
        'harassment/threatening': false,
        'self-harm': false,
        'self-harm/intent': false,
        'self-harm/instructions': false,
        'sexual': false,
        'sexual/minors': false,
        'violence': false,
        'violence/graphic': false
      },
      category_scores: {
        'hate': 0.45,
        'hate/threatening': 0.1,
        'harassment': 0.52,
        'harassment/threatening': 0.2,
        'self-harm': 0.01,
        'self-harm/intent': 0.001,
        'self-harm/instructions': 0.0001,
        'sexual': 0.05,
        'sexual/minors': 0.001,
        'violence': 0.48,
        'violence/graphic': 0.02
      },
      flagged: true
    }]
  },

  // Flagged content
  flaggedContent: {
    id: 'modr-9XcKLnTGqXH8GJgJMBhcn',
    model: 'text-moderation-007',
    results: [{
      categories: {
        'hate': true,
        'hate/threatening': false,
        'harassment': true,
        'harassment/threatening': false,
        'self-harm': false,
        'self-harm/intent': false,
        'self-harm/instructions': false,
        'sexual': false,
        'sexual/minors': false,
        'violence': true,
        'violence/graphic': false
      },
      category_scores: {
        'hate': 0.85,
        'hate/threatening': 0.3,
        'harassment': 0.75,
        'harassment/threatening': 0.4,
        'self-harm': 0.02,
        'self-harm/intent': 0.001,
        'self-harm/instructions': 0.0001,
        'sexual': 0.1,
        'sexual/minors': 0.001,
        'violence': 0.9,
        'violence/graphic': 0.05
      },
      flagged: true
    }]
  },

  // API error responses
  unauthorized: {
    error: {
      message: 'Incorrect API key provided',
      type: 'invalid_request_error',
      param: null,
      code: 'invalid_api_key'
    }
  },

  rateLimitError: {
    error: {
      message: 'Rate limit reached for requests',
      type: 'requests',
      param: null,
      code: 'rate_limit_exceeded'
    }
  }
};

// Helper to create OpenAI moderation mock responses
export function createOpenAIModerationMockResponse(content: string, apiKey?: string) {
  // No API key
  if (!apiKey) {
    return {
      status: 401,
      data: mockOpenAIResponses.unauthorized
    };
  }

  // Invalid API key
  if (apiKey === 'invalid_key') {
    return {
      status: 401,
      data: mockOpenAIResponses.unauthorized
    };
  }

  // Rate limit simulation
  if (apiKey === 'rate_limited_key') {
    return {
      status: 429,
      data: mockOpenAIResponses.rateLimitError
    };
  }

  // Content-based responses
  const lowerContent = content.toLowerCase();
  
  // Check for trigger words
  if (lowerContent.includes('hate') || lowerContent.includes('violence')) {
    return {
      status: 200,
      data: mockOpenAIResponses.flaggedContent
    };
  }

  if (lowerContent.includes('borderline') || lowerContent.includes('maybe')) {
    return {
      status: 200,
      data: mockOpenAIResponses.borderlineContent
    };
  }

  // Default to clean content
  return {
    status: 200,
    data: mockOpenAIResponses.cleanContent
  };
}

// Mock OpenAI client
export class MockOpenAIClient {
  constructor(private apiKey?: string) {}

  moderations = {
    create: async ({ input }: { input: string }) => {
      const response = createOpenAIModerationMockResponse(input, this.apiKey);
      
      if (response.status !== 200) {
        throw new Error(JSON.stringify(response.data));
      }
      
      return response.data;
    }
  };
}