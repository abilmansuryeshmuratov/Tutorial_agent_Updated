import { vi } from 'vitest';

// Create mock functions with proper typing
export const mockGenerateMessageResponse = vi.fn();
export const mockGenerateShouldRespond = vi.fn();
export const mockComposeContext = vi.fn();
export const mockGetEmbeddingZeroVector = vi.fn();
export const mockStringToUuid = vi.fn();

// Set up default mock implementations
mockGenerateMessageResponse.mockImplementation(async () => ({
    text: 'Generated response',
    content: { text: 'Generated response' },
    action: null
}));

mockGenerateShouldRespond.mockImplementation(async () => ({
    shouldRespond: true,
    response: 'RESPOND',
    text: 'RESPOND'
}));

mockComposeContext.mockImplementation(({ state, template }) => {
    return `Composed context with template`;
});

mockGetEmbeddingZeroVector.mockImplementation(() => 
    new Array(1536).fill(0)
);

mockStringToUuid.mockImplementation((str: string) => 
    `uuid-${str}`
);

// Create the mock module
export const coreMock = {
    generateMessageResponse: mockGenerateMessageResponse,
    generateShouldRespond: mockGenerateShouldRespond,
    composeContext: mockComposeContext,
    getEmbeddingZeroVector: mockGetEmbeddingZeroVector,
    stringToUuid: mockStringToUuid,
    elizaLogger: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    },
    ModelClass: {
        SMALL: 'gpt-4o-mini',
        MEDIUM: 'gpt-4o',
        LARGE: 'gpt-4o',
        EMBEDDING: 'text-embedding-3-small',
        IMAGE: 'dall-e-3'
    },
    ServiceType: {
        IMAGE_DESCRIPTION: 'image_description',
        TRANSCRIPTION: 'transcription',
        VIDEO_GENERATION: 'video_generation',
        TEXT_TO_SPEECH: 'text_to_speech',
        SPEECH_TO_TEXT: 'speech_to_text'
    },
    messageCompletionFooter: `\n\n# Additional Information\nMocked footer for testing`,
    shouldRespondFooter: `\n\n# Response Instructions\nMocked footer for testing`
};

// Helper to reset all mocks
export const resetAllMocks = () => {
    mockGenerateMessageResponse.mockClear();
    mockGenerateShouldRespond.mockClear();
    mockComposeContext.mockClear();
    mockGetEmbeddingZeroVector.mockClear();
    mockStringToUuid.mockClear();
};