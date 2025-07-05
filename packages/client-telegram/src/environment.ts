import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const telegramEnvSchema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "Telegram bot token is required"),
    TELEGRAM_GROUP_ONLY_MODE: z.boolean().optional().default(false),
    TELEGRAM_ALLOWED_GROUP_IDS: z.string().optional(),
    TELEGRAM_JOIN_ANNOUNCEMENT: z.boolean().optional().default(true),
    TELEGRAM_API_ROOT: z.string().optional(),
});

export type TelegramConfig = z.infer<typeof telegramEnvSchema>;

export async function validateTelegramConfig(
    runtime: IAgentRuntime
): Promise<TelegramConfig> {
    try {
        const config = {
            TELEGRAM_BOT_TOKEN:
                runtime.getSetting("TELEGRAM_BOT_TOKEN") ||
                process.env.TELEGRAM_BOT_TOKEN,
            TELEGRAM_GROUP_ONLY_MODE:
                runtime.getSetting("TELEGRAM_GROUP_ONLY_MODE") === "true" ||
                process.env.TELEGRAM_GROUP_ONLY_MODE === "true",
            TELEGRAM_ALLOWED_GROUP_IDS:
                runtime.getSetting("TELEGRAM_ALLOWED_GROUP_IDS") ||
                process.env.TELEGRAM_ALLOWED_GROUP_IDS,
            TELEGRAM_JOIN_ANNOUNCEMENT:
                runtime.getSetting("TELEGRAM_JOIN_ANNOUNCEMENT") !== "false" &&
                process.env.TELEGRAM_JOIN_ANNOUNCEMENT !== "false",
            TELEGRAM_API_ROOT:
                runtime.getSetting("TELEGRAM_API_ROOT") ||
                process.env.TELEGRAM_API_ROOT,
        };

        return telegramEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Telegram configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
