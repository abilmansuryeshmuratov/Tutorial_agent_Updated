import type { User, Chat, Message, Update, CallbackQuery } from '@telegraf/types';
import type { Context } from 'telegraf';
import { vi } from 'vitest';

/**
 * Mock factories for Telegram API objects
 * Based on official Telegram Bot API documentation
 */

export const createMockUser = (overrides?: Partial<User>): User => ({
    id: 123456789,
    is_bot: false,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    ...overrides,
});

export const createMockBot = (overrides?: Partial<User>): User => ({
    id: 1234567890,
    is_bot: true,
    first_name: 'Test Bot',
    username: 'testbot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    ...overrides,
});

export const createMockPrivateChat = (overrides?: Partial<Chat.PrivateChat>): Chat.PrivateChat => ({
    id: 123456789,
    type: 'private',
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    ...overrides,
});

export const createMockGroupChat = (overrides?: Partial<Chat.GroupChat>): Chat.GroupChat => ({
    id: -123456789,
    type: 'group',
    title: 'Test Group',
    all_members_are_administrators: false,
    ...overrides,
});

export const createMockSuperGroupChat = (overrides?: Partial<Chat.SupergroupChat>): Chat.SupergroupChat => ({
    id: -1001234567890,
    type: 'supergroup',
    title: 'Test Supergroup',
    username: 'testsupergroup',
    ...overrides,
});

export const createMockTextMessage = (overrides?: Partial<Message.TextMessage>): Message.TextMessage => ({
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: createMockPrivateChat(),
    from: createMockUser(),
    text: 'Test message',
    ...overrides,
});

export const createMockPhotoMessage = (overrides?: Partial<Message.PhotoMessage>): Message.PhotoMessage => ({
    message_id: 2,
    date: Math.floor(Date.now() / 1000),
    chat: createMockPrivateChat(),
    from: createMockUser(),
    photo: [
        {
            file_id: 'photo_small',
            file_unique_id: 'photo_small_unique',
            width: 90,
            height: 90,
            file_size: 1000,
        },
        {
            file_id: 'photo_medium',
            file_unique_id: 'photo_medium_unique',
            width: 320,
            height: 320,
            file_size: 5000,
        },
        {
            file_id: 'photo_large',
            file_unique_id: 'photo_large_unique',
            width: 800,
            height: 800,
            file_size: 10000,
        },
    ],
    caption: 'Test photo',
    ...overrides,
});

export const createMockNewChatMembersMessage = (overrides?: Partial<Message.NewChatMembersMessage>): Message.NewChatMembersMessage => ({
    message_id: 3,
    date: Math.floor(Date.now() / 1000),
    chat: createMockGroupChat(),
    from: createMockUser(),
    new_chat_members: [createMockBot()],
    ...overrides,
});

export const createMockMessageUpdate = (message: Message): Update.MessageUpdate => ({
    update_id: 100000000,
    message,
});

export const createMockCallbackQuery = (overrides?: Partial<CallbackQuery>): CallbackQuery => ({
    id: 'callback123',
    from: createMockUser(),
    message: createMockTextMessage({
        reply_markup: {
            inline_keyboard: [[
                { text: 'Button 1', callback_data: 'action_1' },
                { text: 'Button 2', callback_data: 'action_2' },
            ]],
        },
    }),
    chat_instance: 'chat_instance_123',
    data: 'action_1',
    ...overrides,
});

export const createMockContext = (overrides?: Partial<Context>): Context => {
    const message = createMockTextMessage();
    return {
        update: createMockMessageUpdate(message),
        telegram: {
            sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
            answerCbQuery: vi.fn().mockResolvedValue(true),
            getMe: vi.fn().mockResolvedValue(createMockBot()),
        },
        botInfo: createMockBot(),
        message,
        from: message.from,
        chat: message.chat,
        reply: vi.fn().mockResolvedValue({ message_id: 123 }),
        replyWithPhoto: vi.fn().mockResolvedValue({ message_id: 124 }),
        replyWithDocument: vi.fn().mockResolvedValue({ message_id: 125 }),
        answerCbQuery: vi.fn().mockResolvedValue(true),
        leaveChat: vi.fn().mockResolvedValue(true),
        ...overrides,
    } as any;
};

/**
 * Create mock context for different scenarios
 */
export const createPrivateChatContext = (text: string = 'Hello bot'): Context => {
    const message = createMockTextMessage({
        text,
        chat: createMockPrivateChat(),
    });
    
    return createMockContext({
        message,
        update: createMockMessageUpdate(message),
        chat: message.chat,
        from: message.from,
    });
};

export const createGroupChatContext = (text: string = 'Hello @bot'): Context => {
    const message = createMockTextMessage({
        text,
        chat: createMockGroupChat(),
        entities: text.includes('@') ? [
            {
                type: 'mention',
                offset: text.indexOf('@'),
                length: 4,
            },
        ] : undefined,
    });
    
    return createMockContext({
        message,
        update: createMockMessageUpdate(message),
        chat: message.chat,
        from: message.from,
    });
};

export const createSuperGroupChatContext = (text: string = 'Hello @bot'): Context => {
    const message = createMockTextMessage({
        text,
        chat: createMockSuperGroupChat(),
        entities: text.includes('@') ? [
            {
                type: 'mention',
                offset: text.indexOf('@'),
                length: 4,
            },
        ] : undefined,
    });
    
    return createMockContext({
        message,
        update: createMockMessageUpdate(message),
        chat: message.chat,
        from: message.from,
    });
};

export const createNewMemberContext = (newMembers: User[] = [createMockBot()]): Context => {
    const message = createMockNewChatMembersMessage({
        new_chat_members: newMembers,
        chat: createMockSuperGroupChat(),
    });
    
    return createMockContext({
        message,
        update: createMockMessageUpdate(message),
        chat: message.chat,
        from: message.from,
    });
};

export const createCallbackQueryContext = (data: string = 'action_1'): Context => {
    const callbackQuery = createMockCallbackQuery({ data });
    
    return createMockContext({
        update: {
            update_id: 100000001,
            callback_query: callbackQuery,
        },
        callbackQuery,
        from: callbackQuery.from,
        chat: callbackQuery.message?.chat,
    });
};

/**
 * Create mock API responses
 */
export const createMockApiSuccessResponse = <T>(result: T) => ({
    ok: true,
    result,
});

export const createMockApiErrorResponse = (errorCode: number, description: string) => ({
    ok: false,
    error_code: errorCode,
    description,
});

/**
 * Common Telegram API error responses
 */
export const TELEGRAM_API_ERRORS = {
    BAD_REQUEST: createMockApiErrorResponse(400, 'Bad Request: message text is empty'),
    UNAUTHORIZED: createMockApiErrorResponse(401, 'Unauthorized'),
    FORBIDDEN: createMockApiErrorResponse(403, 'Forbidden: bot was kicked from the group chat'),
    NOT_FOUND: createMockApiErrorResponse(404, 'Not Found: chat not found'),
    TOO_MANY_REQUESTS: createMockApiErrorResponse(429, 'Too Many Requests: retry after 30'),
    CHAT_NOT_FOUND: createMockApiErrorResponse(400, 'Bad Request: chat not found'),
    MESSAGE_TOO_LONG: createMockApiErrorResponse(400, 'Bad Request: message is too long'),
    NO_RIGHTS_TO_SEND: createMockApiErrorResponse(400, 'Bad Request: have no rights to send a message'),
};