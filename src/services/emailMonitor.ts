import { EventEmitter } from "events";
import { ImapFlow, type FetchMessageObject } from "imapflow";
import config from "../config/config.ts";
import type { EmailData } from "../types/index.ts";
import { emailToText } from "../utils/emailCleaner.ts";
import type { Readable } from "stream";
import logger from "../utils/logger.ts";

export declare interface EmailMonitor {
  on(event: "newEmail", listener: (data: EmailData) => void): this;
  emit(event: "newEmail", data: EmailData): boolean;
}

export class EmailMonitor extends EventEmitter {
  private imap: ImapFlow;
  private isMonitoring: boolean = false;

  constructor() {
    super();
    this.imap = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.tls,
      tls: config.imap.tlsOptions,
      auth: {
        user: config.imap.user,
        pass: config.imap.password,
      },
      // logger: false, // Disable default logging
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.imap.connect();
      logger.info("IMAP connection established");
      await this.startMonitoring();
    } catch (err) {
      logger.error("IMAP connection error:", err);
      this.reconnect();
    }
  }

  public end(): void {
    this.isMonitoring = false;
    this.imap.close(); // Close instead of logout for immediate termination
  }

  private async reconnect(): Promise<void> {
    logger.info("Attempting to reconnect to IMAP server...");
    setTimeout(() => {
      this.connect();
    }, 10000);
  }

  private async startMonitoring(): Promise<void> {
    this.isMonitoring = true;

    // Set up event handlers
    this.imap.on("exists", (data) => {
      logger.info(`New message notification: count=${data.count}, previous=${data.prevCount}`);
      if (data.count > data.prevCount) {
        this.checkNewEmails();
      }
    });

    this.imap.on("error", (err) => {
      logger.error("IMAP Error:", err);
      if (this.isMonitoring) {
        this.reconnect();
      }
    });

    this.imap.on("close", () => {
      logger.info("IMAP connection closed");
      if (this.isMonitoring) {
        this.reconnect();
      }
    });

    try {
      // Open the mailbox first
      const mailbox = await this.imap.mailboxOpen("INBOX");
      logger.info(`Opened mailbox: ${mailbox.path} with ${mailbox.exists} messages`);

      // Check for existing unseen emails first
      await this.checkNewEmails();

      // Start IDLE mode - this will wait for server notifications
      while (this.isMonitoring) {
        try {
          logger.info("Entering IDLE mode");
          await this.imap.idle();
          logger.info("IDLE mode ended");
        } catch (err) {
          logger.error("Error in IDLE mode:", err);
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (err) {
      logger.error("Error in monitoring:", err);
      if (this.isMonitoring) {
        this.reconnect();
      }
    }
  }

  private async checkNewEmails(): Promise<void> {
    logger.info("Checking for new emails");

    try {
      const lock = await this.imap.getMailboxLock("INBOX");

      try {
        const targetEmails = config.monitoring.targetEmails;
        logger.info(`Looking for emails addressed to: ${targetEmails.join(", ")}`);

        // Fetch all unseen messages
        for await (const msg of this.imap.fetch({ seen: false }, {
          uid: true,
          envelope: true,
          bodyStructure: true,
          flags: true
        })) {
          await this.processMessage(msg, targetEmails);
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      logger.error("Error in checkNewEmails:", err);
    }
  }

  private async processMessage(
    msg: FetchMessageObject,
    targetEmails: string[]
  ): Promise<void> {
    try {
      const { envelope, uid } = msg;
      logger.info(`Processing message: uid=${uid}, subject="${envelope.subject}"`);

      // Check recipients (both To and CC fields)
      const allRecipients = [
        ...(envelope.to || []),
        ...(envelope.cc || [])
      ];

      const matchedEmail = allRecipients.find(
        recipient => recipient.address && targetEmails.includes(recipient.address.toLowerCase())
      );

      if (!matchedEmail) {
        logger.info(`Message uid=${uid} is not addressed to monitored emails`);
        return;
      }

      logger.info(`Found targeted email to ${matchedEmail.address}`);

      // Download the full message
      const { content } = await this.imap.download(uid.toString(), undefined, { uid: true });
      const textStr = await this.readableToString(content);
      const cleanedText = emailToText(textStr);

      // Mark as seen after successfully processing
      await this.imap.messageFlagsAdd(uid.toString(), ["\\Seen"], { uid: true });

      const emailData: EmailData = {
        subject: envelope.subject || "(No Subject)",
        recipient: matchedEmail.address || "",
        date: envelope.date || new Date(),
        content: cleanedText,
      };

      logger.info(`Emitting newEmail event for: "${emailData.subject}"`);
      this.emit("newEmail", emailData);
    } catch (err) {
      logger.error(`Error processing message: ${err}`);
    }
  }

  private async readableToString(readable: Readable): Promise<string> {
    const chunks = [];
    for await (const chunk of readable) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
  }
}
