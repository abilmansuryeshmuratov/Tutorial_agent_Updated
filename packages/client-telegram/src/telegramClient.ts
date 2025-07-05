import { type Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import { MessageManager } from "./messageManager.ts";
import { getOrCreateRecommenderInBe } from "./getOrCreateRecommenderInBe.ts";

export class TelegramClient {
    private bot: Telegraf<Context>;
    private runtime: IAgentRuntime;
    private messageManager: MessageManager;
    private backend;
    private backendToken;
    private tgTrader;
    private options;
    private groupOnlyMode: boolean;
    private allowedGroupIds: string[];
    private joinAnnouncement: boolean;

    constructor(runtime: IAgentRuntime, botToken: string) {
        elizaLogger.log("📱 Constructing new TelegramClient...");
        this.options = {
            telegram: {
                apiRoot: runtime.getSetting("TELEGRAM_API_ROOT") || process.env.TELEGRAM_API_ROOT || "https://api.telegram.org"
            },
        };
        this.runtime = runtime;
        this.bot = new Telegraf(botToken,this.options);
        this.messageManager = new MessageManager(this.bot, this.runtime);
        this.backend = runtime.getSetting("BACKEND_URL");
        this.backendToken = runtime.getSetting("BACKEND_TOKEN");
        this.tgTrader = runtime.getSetting("TG_TRADER"); // boolean To Be added to the settings
        
        // Group-only mode configuration
        this.groupOnlyMode = runtime.getSetting("TELEGRAM_GROUP_ONLY_MODE") === "true" || 
                           process.env.TELEGRAM_GROUP_ONLY_MODE === "true";
        
        const allowedGroups = runtime.getSetting("TELEGRAM_ALLOWED_GROUP_IDS") || 
                            process.env.TELEGRAM_ALLOWED_GROUP_IDS || "";
        this.allowedGroupIds = allowedGroups ? allowedGroups.split(",").map(id => id.trim()) : [];
        
        this.joinAnnouncement = runtime.getSetting("TELEGRAM_JOIN_ANNOUNCEMENT") !== "false" && 
                              process.env.TELEGRAM_JOIN_ANNOUNCEMENT !== "false";
        
        elizaLogger.log("✅ TelegramClient constructor completed");
        elizaLogger.log(`📋 Group-only mode: ${this.groupOnlyMode}`);
        elizaLogger.log(`📋 Allowed groups: ${this.allowedGroupIds.length > 0 ? this.allowedGroupIds.join(", ") : "All groups"}`);
    }

    public async start(): Promise<void> {
        elizaLogger.log("🚀 Starting Telegram bot...");
        try {
            await this.initializeBot();
            this.setupMessageHandlers();
            this.setupShutdownHandlers();
        } catch (error) {
            elizaLogger.error("❌ Failed to launch Telegram bot:", error);
            throw error;
        }
    }

    private async initializeBot(): Promise<void> {
        this.bot.launch({ dropPendingUpdates: true });
        elizaLogger.log(
            "✨ Telegram bot successfully launched and is running!"
        );

        const botInfo = await this.bot.telegram.getMe();
        this.bot.botInfo = botInfo;
        elizaLogger.success(`Bot username: @${botInfo.username}`);

        this.messageManager.bot = this.bot;
    }

    private async isGroupAuthorized(ctx: Context): Promise<boolean> {
        const config = this.runtime.character.clientConfig?.telegram;
        if (ctx.from?.id === ctx.botInfo?.id) {
            return false;
        }

        // Check if chat is a DM (private chat) and group-only mode is enabled
        if (this.groupOnlyMode && ctx.chat?.type === 'private') {
            elizaLogger.info(`Ignoring DM from user ${ctx.from?.id} in group-only mode`);
            return false;
        }

        // If specific groups are allowed, check if current group is in the list
        if (this.allowedGroupIds.length > 0 && ctx.chat?.type !== 'private') {
            const currentGroupId = ctx.chat.id.toString();
            if (!this.allowedGroupIds.includes(currentGroupId)) {
                elizaLogger.info(`Group ${currentGroupId} not in allowed list`);
                try {
                    await ctx.reply("I'm not authorized to operate in this group. Leaving.");
                    await ctx.leaveChat();
                } catch (error) {
                    elizaLogger.error(
                        `Error leaving unauthorized group ${currentGroupId}:`,
                        error
                    );
                }
                return false;
            }
        }

        // Legacy config support
        if (!config?.shouldOnlyJoinInAllowedGroups) {
            return true;
        }

        const allowedGroups = config.allowedGroupIds || [];
        const currentGroupId = ctx.chat.id.toString();

        if (!allowedGroups.includes(currentGroupId)) {
            elizaLogger.info(`Unauthorized group detected: ${currentGroupId}`);
            try {
                await ctx.reply("Not authorized. Leaving.");
                await ctx.leaveChat();
            } catch (error) {
                elizaLogger.error(
                    `Error leaving unauthorized group ${currentGroupId}:`,
                    error
                );
            }
            return false;
        }

        return true;
    }

    private setupMessageHandlers(): void {
        elizaLogger.log("Setting up message handler...");

        this.bot.on(message("new_chat_members"), async (ctx) => {
            try {
                const newMembers = ctx.message.new_chat_members;
                const isBotAdded = newMembers.some(
                    (member) => member.id === ctx.botInfo.id
                );

                if (isBotAdded) {
                    // Check authorization first
                    if (!(await this.isGroupAuthorized(ctx))) {
                        return;
                    }
                    
                    // Send join announcement if enabled
                    if (this.joinAnnouncement && ctx.chat?.type !== 'private') {
                        const groupName = 'title' in ctx.chat ? ctx.chat.title : 'this group';
                        const announcement = `👋 Hello ${groupName}! I'm ${this.runtime.character.name}, your AI assistant. ` +
                                           `I'm here to help with blockchain insights, answer questions, and engage in discussions. ` +
                                           `Feel free to mention me in your messages!`;
                        
                        try {
                            await ctx.reply(announcement);
                            elizaLogger.log(`Sent join announcement to group: ${ctx.chat.id}`);
                        } catch (error) {
                            elizaLogger.error("Failed to send join announcement:", error);
                        }
                    }
                }
            } catch (error) {
                elizaLogger.error("Error handling new chat members:", error);
            }
        });

        this.bot.on("message", async (ctx) => {
            try {
                // Check group authorization first
                if (!(await this.isGroupAuthorized(ctx))) {
                    return;
                }

                if (this.tgTrader) {
                    const userId = ctx.from?.id.toString();
                    const username =
                        ctx.from?.username || ctx.from?.first_name || "Unknown";
                    if (!userId) {
                        elizaLogger.warn(
                            "Received message from a user without an ID."
                        );
                        return;
                    }
                    try {
                        await getOrCreateRecommenderInBe(
                            userId,
                            username,
                            this.backendToken,
                            this.backend
                        );
                    } catch (error) {
                        elizaLogger.error(
                            "Error getting or creating recommender in backend",
                            error
                        );
                    }
                }

                await this.messageManager.handleMessage(ctx);
            } catch (error) {
                elizaLogger.error("❌ Error handling message:", error);
                // Don't try to reply if we've left the group or been kicked
                if (error?.response?.error_code !== 403) {
                    try {
                        await ctx.reply(
                            "An error occurred while processing your message."
                        );
                    } catch (replyError) {
                        elizaLogger.error(
                            "Failed to send error message:",
                            replyError
                        );
                    }
                }
            }
        });

        this.bot.on("photo", (ctx) => {
            elizaLogger.log(
                "📸 Received photo message with caption:",
                ctx.message.caption
            );
        });

        this.bot.on("document", (ctx) => {
            elizaLogger.log(
                "📎 Received document message:",
                ctx.message.document.file_name
            );
        });

        this.bot.catch((err, ctx) => {
            elizaLogger.error(`❌ Telegram Error for ${ctx.updateType}:`, err);
            ctx.reply("An unexpected error occurred. Please try again later.");
        });
    }

    private setupShutdownHandlers(): void {
        const shutdownHandler = async (signal: string) => {
            elizaLogger.log(
                `⚠️ Received ${signal}. Shutting down Telegram bot gracefully...`
            );
            try {
                await this.stop();
                elizaLogger.log("🛑 Telegram bot stopped gracefully");
            } catch (error) {
                elizaLogger.error(
                    "❌ Error during Telegram bot shutdown:",
                    error
                );
                throw error;
            }
        };

        process.once("SIGINT", () => shutdownHandler("SIGINT"));
        process.once("SIGTERM", () => shutdownHandler("SIGTERM"));
        process.once("SIGHUP", () => shutdownHandler("SIGHUP"));
    }

    public async stop(): Promise<void> {
        elizaLogger.log("Stopping Telegram bot...");
        //await 
            this.bot.stop();
        elizaLogger.log("Telegram bot stopped");
    }
}
