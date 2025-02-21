import { EmailMonitor } from "./services/emailMonitor.js";
import { TelegramService } from "./services/telegramService.js";
import logger from "./utils/logger.js";

try {
  logger.info("Starting Email-Telegram Forwarder");

  const emailMonitor = new EmailMonitor();
  const telegramService = new TelegramService();

  emailMonitor.on("newEmail", async (emailData) => {
    try {
      await telegramService.sendMessage(emailData);
    } catch (err) {
      logger.error("Error forwarding email to Telegram:", err);
    }
  });

  emailMonitor.connect();

  process.on("SIGINT", () => {
    logger.info("Shutting down...");
    emailMonitor.end();
    process.exit(0);
  });
} catch (err) {
  logger.error("Application error:", err);
  process.exit(1);
}
