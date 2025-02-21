import TelegramBot from "node-telegram-bot-api";
import logger from "../utils/logger.js";
import config from "../config/config.js";
import type { EmailData } from "../types";
import { encode as encodeHTMLEntities } from 'html-entities';

interface RateLimit {
  requests: number;
  resetTime: number;
}

export class TelegramService {
  private bot: TelegramBot;
  private rateLimit: RateLimit;

  constructor() {
    this.bot = new TelegramBot(config.telegram.token, { polling: false });
    this.rateLimit = {
      requests: 0,
      resetTime: Date.now() + config.rateLimit.windowMs,
    };
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now > this.rateLimit.resetTime) {
      this.rateLimit.requests = 0;
      this.rateLimit.resetTime = now + config.rateLimit.windowMs;
    }

    if (this.rateLimit.requests >= config.rateLimit.maxRequests) {
      throw new Error("Rate limit exceeded");
    }

    this.rateLimit.requests++;
  }

  public async sendMessage(emailData: EmailData): Promise<void> {
    try {
      await this.checkRateLimit();

      const formattedDate = emailData.date.toLocaleString();
      const cleanedContent = encodeHTMLEntities(emailData.content);

      const message = `<b>${emailData.subject}</b>
📩 ${emailData.recipient}
(${formattedDate})

<blockquote expandable>
${cleanedContent}
</blockquote>
`

      logger.info("Message sending to Telegram", {
        subject: emailData.subject,
        recipient: emailData.recipient,
        message: cleanedContent,
        channelId: config.telegram.channelId,
      });

      await this.bot.sendMessage(config.telegram.channelId, message, {
        parse_mode: "HTML"
      });
    } catch (err) {
      logger.error("Error sending message to Telegram:", err);
      throw err;
    }
  }
}
