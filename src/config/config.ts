import { z } from "zod";
import type { AppConfig } from "../types";

const configSchema = z.object({
  IMAP_HOST: z.string().min(1),
  IMAP_PORT: z.coerce.number().int().positive(),
  IMAP_USER: z.string().email(),
  IMAP_PASSWORD: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHANNEL_ID: z.string().min(1),
  CHECK_INTERVAL: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
  console.error("❌ Invalid configuration:", parsedConfig.error.format());
  process.exit(1);
}

const env = parsedConfig.data;

const config: AppConfig = {
  imap: {
    user: env.IMAP_USER,
    password: env.IMAP_PASSWORD,
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    tls: true,
    tlsOptions: { rejectUnauthorized: true },
  },
  telegram: {
    token: env.TELEGRAM_BOT_TOKEN,
    channelId: env.TELEGRAM_CHANNEL_ID,
  },
  monitoring: {
    targetEmails: ["claude@pan93.com", "gpt@pan93.com"],
    checkInterval: env.CHECK_INTERVAL,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
};

export default config;
