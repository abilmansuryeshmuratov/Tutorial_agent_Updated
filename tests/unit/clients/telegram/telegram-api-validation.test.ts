import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import type { Message, Update, User, Chat } from '@telegraf/types';

// Telegram API Validation Schemas based on official documentation
// https://core.telegram.org/bots/api

// User validation schema
const telegramUserSchema = z.object({
    id: z.number().positive(),
    is_bot: z.boolean(),
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
    is_premium: z.boolean().optional(),
    added_to_attachment_menu: z.boolean().optional(),
});

// Chat validation schema
const telegramChatSchema = z.object({
    id: z.number(),
    type: z.enum(['private', 'group', 'supergroup', 'channel']),
    title: z.string().optional(),
    username: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    is_forum: z.boolean().optional(),
    photo: z.object({
        small_file_id: z.string(),
        small_file_unique_id: z.string(),
        big_file_id: z.string(),
        big_file_unique_id: z.string(),
    }).optional(),
    active_usernames: z.array(z.string()).optional(),
    emoji_status_custom_emoji_id: z.string().optional(),
    bio: z.string().optional(),
    has_private_forwards: z.boolean().optional(),
    has_restricted_voice_and_video_messages: z.boolean().optional(),
    join_to_send_messages: z.boolean().optional(),
    join_by_request: z.boolean().optional(),
    description: z.string().optional(),
    invite_link: z.string().optional(),
    pinned_message: z.any().optional(), // Recursive type
    permissions: z.any().optional(),
    slow_mode_delay: z.number().optional(),
    message_auto_delete_time: z.number().optional(),
    has_aggressive_anti_spam_enabled: z.boolean().optional(),
    has_hidden_members: z.boolean().optional(),
    has_protected_content: z.boolean().optional(),
    sticker_set_name: z.string().optional(),
    can_set_sticker_set: z.boolean().optional(),
    linked_chat_id: z.number().optional(),
    location: z.any().optional(),
});

// Message entity validation
const messageEntitySchema = z.object({
    type: z.enum([
        'mention', 'hashtag', 'cashtag', 'bot_command', 'url', 'email',
        'phone_number', 'bold', 'italic', 'underline', 'strikethrough',
        'spoiler', 'code', 'pre', 'text_link', 'text_mention', 'custom_emoji'
    ]),
    offset: z.number().nonnegative(),
    length: z.number().positive(),
    url: z.string().optional(),
    user: z.lazy(() => telegramUserSchema).optional(),
    language: z.string().optional(),
    custom_emoji_id: z.string().optional(),
});

// Base message validation schema
const baseMessageSchema = z.object({
    message_id: z.number().positive(),
    message_thread_id: z.number().optional(),
    from: telegramUserSchema.optional(),
    sender_chat: telegramChatSchema.optional(),
    date: z.number().positive(),
    chat: telegramChatSchema,
    forward_from: telegramUserSchema.optional(),
    forward_from_chat: telegramChatSchema.optional(),
    forward_from_message_id: z.number().optional(),
    forward_signature: z.string().optional(),
    forward_sender_name: z.string().optional(),
    forward_date: z.number().optional(),
    is_topic_message: z.boolean().optional(),
    is_automatic_forward: z.boolean().optional(),
    reply_to_message: z.any().optional(), // Recursive type
    via_bot: telegramUserSchema.optional(),
    edit_date: z.number().optional(),
    has_protected_content: z.boolean().optional(),
    media_group_id: z.string().optional(),
    author_signature: z.string().optional(),
});

// Text message validation
const textMessageSchema = baseMessageSchema.extend({
    text: z.string().min(1).max(4096),
    entities: z.array(messageEntitySchema).optional(),
});

// Photo message validation
const photoMessageSchema = baseMessageSchema.extend({
    photo: z.array(z.object({
        file_id: z.string(),
        file_unique_id: z.string(),
        width: z.number().positive(),
        height: z.number().positive(),
        file_size: z.number().optional(),
    })).min(1),
    caption: z.string().max(1024).optional(),
    caption_entities: z.array(messageEntitySchema).optional(),
});

// New chat members validation
const newChatMembersMessageSchema = baseMessageSchema.extend({
    new_chat_members: z.array(telegramUserSchema).min(1),
});

// Update validation schemas
const messageUpdateSchema = z.object({
    update_id: z.number().positive(),
    message: z.union([textMessageSchema, photoMessageSchema, newChatMembersMessageSchema]),
});

// Bot info validation (from getMe)
const botInfoSchema = z.object({
    id: z.number().positive(),
    is_bot: z.literal(true),
    first_name: z.string().min(1),
    username: z.string().min(1),
    can_join_groups: z.boolean().optional(),
    can_read_all_group_messages: z.boolean().optional(),
    supports_inline_queries: z.boolean().optional(),
});

// API response validation
const telegramApiResponseSchema = z.object({
    ok: z.boolean(),
    result: z.any().optional(),
    error_code: z.number().optional(),
    description: z.string().optional(),
});

describe('Telegram API Validation', () => {
    describe('User Validation', () => {
        it('should validate a valid user object', () => {
            const validUser = {
                id: 123456789,
                is_bot: false,
                first_name: 'John',
                last_name: 'Doe',
                username: 'johndoe',
                language_code: 'en',
            };
            
            const result = telegramUserSchema.safeParse(validUser);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(123456789);
                expect(result.data.username).toBe('johndoe');
            }
        });

        it('should reject invalid user objects', () => {
            const invalidUser = {
                id: -1, // Negative ID
                is_bot: 'yes', // Wrong type
                // Missing required first_name
            };
            
            const result = telegramUserSchema.safeParse(invalidUser);
            expect(result.success).toBe(false);
        });
    });

    describe('Chat Validation', () => {
        it('should validate private chat', () => {
            const privateChat = {
                id: 123456789,
                type: 'private',
                first_name: 'John',
                last_name: 'Doe',
                username: 'johndoe',
            };
            
            const result = telegramChatSchema.safeParse(privateChat);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('private');
            }
        });

        it('should validate group chat', () => {
            const groupChat = {
                id: -1001234567890,
                type: 'supergroup',
                title: 'Test Group',
                username: 'testgroup',
            };
            
            const result = telegramChatSchema.safeParse(groupChat);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('supergroup');
                expect(result.data.title).toBe('Test Group');
            }
        });

        it('should reject invalid chat types', () => {
            const invalidChat = {
                id: 123,
                type: 'invalid_type',
            };
            
            const result = telegramChatSchema.safeParse(invalidChat);
            expect(result.success).toBe(false);
        });
    });

    describe('Message Validation', () => {
        it('should validate text message', () => {
            const textMessage = {
                message_id: 1,
                date: Date.now() / 1000,
                chat: {
                    id: 123456789,
                    type: 'private',
                    first_name: 'John',
                },
                text: 'Hello, bot!',
                from: {
                    id: 123456789,
                    is_bot: false,
                    first_name: 'John',
                },
            };
            
            const result = textMessageSchema.safeParse(textMessage);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.text).toBe('Hello, bot!');
            }
        });

        it('should validate message with entities', () => {
            const messageWithEntities = {
                message_id: 2,
                date: Date.now() / 1000,
                chat: {
                    id: 123456789,
                    type: 'private',
                    first_name: 'John',
                },
                text: '/start @bot_name https://example.com',
                entities: [
                    {
                        type: 'bot_command',
                        offset: 0,
                        length: 6,
                    },
                    {
                        type: 'mention',
                        offset: 7,
                        length: 9,
                    },
                    {
                        type: 'url',
                        offset: 17,
                        length: 19,
                    },
                ],
            };
            
            const result = textMessageSchema.safeParse(messageWithEntities);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.entities).toHaveLength(3);
                expect(result.data.entities![0].type).toBe('bot_command');
            }
        });

        it('should reject messages exceeding text limit', () => {
            const longMessage = {
                message_id: 3,
                date: Date.now() / 1000,
                chat: {
                    id: 123456789,
                    type: 'private',
                    first_name: 'John',
                },
                text: 'a'.repeat(4097), // Exceeds 4096 limit
            };
            
            const result = textMessageSchema.safeParse(longMessage);
            expect(result.success).toBe(false);
        });

        it('should validate new chat members message', () => {
            const newMembersMessage = {
                message_id: 4,
                date: Date.now() / 1000,
                chat: {
                    id: -1001234567890,
                    type: 'supergroup',
                    title: 'Test Group',
                },
                new_chat_members: [
                    {
                        id: 987654321,
                        is_bot: true,
                        first_name: 'Test Bot',
                        username: 'testbot',
                    },
                ],
            };
            
            const result = newChatMembersMessageSchema.safeParse(newMembersMessage);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.new_chat_members).toHaveLength(1);
                expect(result.data.new_chat_members[0].is_bot).toBe(true);
            }
        });
    });

    describe('Update Validation', () => {
        it('should validate message update', () => {
            const update = {
                update_id: 100000000,
                message: {
                    message_id: 1,
                    date: Date.now() / 1000,
                    chat: {
                        id: 123456789,
                        type: 'private',
                        first_name: 'John',
                    },
                    text: 'Test message',
                },
            };
            
            const result = messageUpdateSchema.safeParse(update);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.update_id).toBe(100000000);
            }
        });
    });

    describe('Bot Info Validation', () => {
        it('should validate bot info from getMe', () => {
            const botInfo = {
                id: 1234567890,
                is_bot: true,
                first_name: 'Test Bot',
                username: 'testbot',
                can_join_groups: true,
                can_read_all_group_messages: false,
                supports_inline_queries: false,
            };
            
            const result = botInfoSchema.safeParse(botInfo);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is_bot).toBe(true);
                expect(result.data.can_join_groups).toBe(true);
            }
        });

        it('should reject non-bot users as bot info', () => {
            const nonBot = {
                id: 123456789,
                is_bot: false, // Should be true for bots
                first_name: 'Not a bot',
                username: 'notabot',
            };
            
            const result = botInfoSchema.safeParse(nonBot);
            expect(result.success).toBe(false);
        });
    });

    describe('API Response Validation', () => {
        it('should validate successful API response', () => {
            const successResponse = {
                ok: true,
                result: {
                    message_id: 1,
                    date: Date.now() / 1000,
                    chat: { id: 123, type: 'private' },
                    text: 'Message sent',
                },
            };
            
            const result = telegramApiResponseSchema.safeParse(successResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ok).toBe(true);
                expect(result.data.result).toBeDefined();
            }
        });

        it('should validate error API response', () => {
            const errorResponse = {
                ok: false,
                error_code: 400,
                description: 'Bad Request: message text is empty',
            };
            
            const result = telegramApiResponseSchema.safeParse(errorResponse);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ok).toBe(false);
                expect(result.data.error_code).toBe(400);
                expect(result.data.description).toContain('Bad Request');
            }
        });
    });

    describe('Validation Helpers', () => {
        // Type guards for runtime type checking
        const isTextMessage = (msg: any): msg is Message.TextMessage => {
            return textMessageSchema.safeParse(msg).success;
        };

        const isPhotoMessage = (msg: any): msg is Message.PhotoMessage => {
            return photoMessageSchema.safeParse(msg).success;
        };

        const isGroupChat = (chat: any): boolean => {
            const result = telegramChatSchema.safeParse(chat);
            return result.success && (result.data.type === 'group' || result.data.type === 'supergroup');
        };

        it('should correctly identify message types', () => {
            const textMsg = {
                message_id: 1,
                date: Date.now() / 1000,
                chat: { id: 123, type: 'private' },
                text: 'Hello',
            };
            
            const photoMsg = {
                message_id: 2,
                date: Date.now() / 1000,
                chat: { id: 123, type: 'private' },
                photo: [{ file_id: 'abc', file_unique_id: 'def', width: 100, height: 100 }],
            };
            
            expect(isTextMessage(textMsg)).toBe(true);
            expect(isPhotoMessage(textMsg)).toBe(false);
            expect(isTextMessage(photoMsg)).toBe(false);
            expect(isPhotoMessage(photoMsg)).toBe(true);
        });

        it('should correctly identify chat types', () => {
            const privateChat = { id: 123, type: 'private' };
            const groupChat = { id: -123, type: 'group' };
            const supergroupChat = { id: -1001234567890, type: 'supergroup' };
            
            expect(isGroupChat(privateChat)).toBe(false);
            expect(isGroupChat(groupChat)).toBe(true);
            expect(isGroupChat(supergroupChat)).toBe(true);
        });
    });
});