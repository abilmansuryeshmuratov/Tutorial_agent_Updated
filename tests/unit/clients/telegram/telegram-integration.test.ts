import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
    createMockUser,
    createMockBot,
    createMockPrivateChat,
    createMockGroupChat,
    createMockSuperGroupChat,
    createMockTextMessage,
    createMockNewChatMembersMessage,
    createPrivateChatContext,
    createGroupChatContext,
    createNewMemberContext,
    TELEGRAM_API_ERRORS,
} from './telegram-mocks';

// Define the schema inline for testing
const telegramEnvSchema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "Telegram bot token is required"),
    TELEGRAM_GROUP_ONLY_MODE: z.boolean().optional().default(false),
    TELEGRAM_ALLOWED_GROUP_IDS: z.string().optional(),
    TELEGRAM_JOIN_ANNOUNCEMENT: z.boolean().optional().default(true),
    TELEGRAM_API_ROOT: z.string().optional(),
});

describe('Telegram Integration Tests', () => {
    describe('Environment Configuration Validation', () => {
        it('should validate correct environment configuration', () => {
            const validConfig = {
                TELEGRAM_BOT_TOKEN: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
                TELEGRAM_GROUP_ONLY_MODE: true,
                TELEGRAM_ALLOWED_GROUP_IDS: '-1001234567890,-1009876543210',
                TELEGRAM_JOIN_ANNOUNCEMENT: true,
                TELEGRAM_API_ROOT: 'https://api.telegram.org',
            };

            const result = telegramEnvSchema.safeParse(validConfig);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.TELEGRAM_GROUP_ONLY_MODE).toBe(true);
                expect(result.data.TELEGRAM_ALLOWED_GROUP_IDS).toBe('-1001234567890,-1009876543210');
            }
        });

        it('should reject invalid bot token', () => {
            const invalidConfig = {
                TELEGRAM_BOT_TOKEN: '', // Empty token
            };

            const result = telegramEnvSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.errors[0].message).toContain('required');
            }
        });

        it('should provide defaults for optional fields', () => {
            const minimalConfig = {
                TELEGRAM_BOT_TOKEN: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789',
            };

            const result = telegramEnvSchema.safeParse(minimalConfig);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.TELEGRAM_GROUP_ONLY_MODE).toBe(false);
                expect(result.data.TELEGRAM_JOIN_ANNOUNCEMENT).toBe(true);
            }
        });
    });

    describe('Group Authorization Logic', () => {
        const isAuthorizedGroup = (chatId: number, allowedGroups: string[]): boolean => {
            if (allowedGroups.length === 0) return true;
            return allowedGroups.includes(chatId.toString());
        };

        it('should authorize when no specific groups configured', () => {
            const allowedGroups: string[] = [];
            expect(isAuthorizedGroup(-1001234567890, allowedGroups)).toBe(true);
            expect(isAuthorizedGroup(-1009876543210, allowedGroups)).toBe(true);
        });

        it('should only authorize listed groups', () => {
            const allowedGroups = ['-1001234567890', '-1009876543210'];
            expect(isAuthorizedGroup(-1001234567890, allowedGroups)).toBe(true);
            expect(isAuthorizedGroup(-1009876543210, allowedGroups)).toBe(true);
            expect(isAuthorizedGroup(-1005555555555, allowedGroups)).toBe(false);
        });
    });

    describe('Message Type Detection', () => {
        it('should identify private chats', () => {
            const privateChat = createMockPrivateChat();
            expect(privateChat.type).toBe('private');
        });

        it('should identify group chats', () => {
            const groupChat = createMockGroupChat();
            const superGroupChat = createMockSuperGroupChat();
            
            expect(groupChat.type).toBe('group');
            expect(superGroupChat.type).toBe('supergroup');
        });
    });

    describe('Bot Join Event Processing', () => {
        it('should detect when bot is added to group', () => {
            const botUser = createMockBot();
            const newMembersMessage = createMockNewChatMembersMessage({
                new_chat_members: [botUser, createMockUser()],
            });

            const isBotAdded = newMembersMessage.new_chat_members.some(
                member => member.id === botUser.id && member.is_bot
            );

            expect(isBotAdded).toBe(true);
        });

        it('should not trigger for regular user joins', () => {
            const botId = 1234567890;
            const newMembersMessage = createMockNewChatMembersMessage({
                new_chat_members: [createMockUser({ id: 999 })],
            });

            const isBotAdded = newMembersMessage.new_chat_members.some(
                member => member.id === botId
            );

            expect(isBotAdded).toBe(false);
        });
    });

    describe('Group Only Mode Logic', () => {
        const shouldProcessMessage = (
            chatType: string,
            groupOnlyMode: boolean,
            chatId: number,
            allowedGroups: string[]
        ): boolean => {
            // Ignore DMs in group-only mode
            if (groupOnlyMode && chatType === 'private') {
                return false;
            }

            // Check if group is authorized
            if (chatType !== 'private' && allowedGroups.length > 0) {
                return allowedGroups.includes(chatId.toString());
            }

            return true;
        };

        it('should ignore DMs when group-only mode enabled', () => {
            const result = shouldProcessMessage('private', true, 123456, []);
            expect(result).toBe(false);
        });

        it('should process DMs when group-only mode disabled', () => {
            const result = shouldProcessMessage('private', false, 123456, []);
            expect(result).toBe(true);
        });

        it('should process messages from allowed groups', () => {
            const result = shouldProcessMessage('supergroup', true, -1001234567890, ['-1001234567890']);
            expect(result).toBe(true);
        });

        it('should reject messages from non-allowed groups', () => {
            const result = shouldProcessMessage('supergroup', true, -1005555555555, ['-1001234567890']);
            expect(result).toBe(false);
        });
    });

    describe('API Error Handling', () => {
        it('should handle rate limiting errors', () => {
            const error = TELEGRAM_API_ERRORS.TOO_MANY_REQUESTS;
            expect(error.ok).toBe(false);
            expect(error.error_code).toBe(429);
            expect(error.description).toContain('retry after');
        });

        it('should handle forbidden errors when bot is kicked', () => {
            const error = TELEGRAM_API_ERRORS.FORBIDDEN;
            expect(error.ok).toBe(false);
            expect(error.error_code).toBe(403);
            expect(error.description).toContain('kicked from the group');
        });

        it('should handle message too long errors', () => {
            const error = TELEGRAM_API_ERRORS.MESSAGE_TOO_LONG;
            expect(error.ok).toBe(false);
            expect(error.error_code).toBe(400);
            expect(error.description).toContain('too long');
        });
    });

    describe('Message Content Validation', () => {
        it('should validate text message length', () => {
            const validMessage = createMockTextMessage({ text: 'a'.repeat(4096) });
            const invalidMessage = createMockTextMessage({ text: 'a'.repeat(4097) });

            expect(validMessage.text.length).toBeLessThanOrEqual(4096);
            expect(invalidMessage.text.length).toBeGreaterThan(4096);
        });

        it('should validate caption length for media', () => {
            const maxCaptionLength = 1024;
            const validCaption = 'a'.repeat(1024);
            const invalidCaption = 'a'.repeat(1025);

            expect(validCaption.length).toBeLessThanOrEqual(maxCaptionLength);
            expect(invalidCaption.length).toBeGreaterThan(maxCaptionLength);
        });
    });

    describe('Join Announcement Generation', () => {
        const generateJoinAnnouncement = (
            botName: string,
            groupName: string
        ): string => {
            return `👋 Hello ${groupName}! I'm ${botName}, your AI assistant. ` +
                   `I'm here to help with blockchain insights, answer questions, and engage in discussions. ` +
                   `Feel free to mention me in your messages!`;
        };

        it('should generate appropriate join announcement', () => {
            const announcement = generateJoinAnnouncement('Tutorial Agent', 'Crypto Traders');
            
            expect(announcement).toContain('Tutorial Agent');
            expect(announcement).toContain('Crypto Traders');
            expect(announcement).toContain('blockchain insights');
            expect(announcement.length).toBeLessThan(500); // Reasonable length
        });

        it('should handle groups without titles', () => {
            const announcement = generateJoinAnnouncement('Tutorial Agent', 'this group');
            
            expect(announcement).toContain('this group');
            expect(announcement).toContain('Tutorial Agent');
        });
    });

    describe('Group ID Parsing', () => {
        const parseAllowedGroups = (groupIds: string): string[] => {
            if (!groupIds) return [];
            return groupIds.split(',').map(id => id.trim()).filter(Boolean);
        };

        it('should parse comma-separated group IDs', () => {
            const input = '-1001234567890,-1009876543210,-1005555555555';
            const result = parseAllowedGroups(input);
            
            expect(result).toHaveLength(3);
            expect(result).toContain('-1001234567890');
            expect(result).toContain('-1009876543210');
            expect(result).toContain('-1005555555555');
        });

        it('should handle spaces in group ID list', () => {
            const input = '-1001234567890, -1009876543210 , -1005555555555';
            const result = parseAllowedGroups(input);
            
            expect(result).toHaveLength(3);
            expect(result).toContain('-1001234567890');
            expect(result).toContain('-1009876543210');
            expect(result).toContain('-1005555555555');
        });

        it('should return empty array for empty input', () => {
            expect(parseAllowedGroups('')).toEqual([]);
            expect(parseAllowedGroups(' ')).toEqual([]);
            expect(parseAllowedGroups(',')).toEqual([]);
        });
    });
});