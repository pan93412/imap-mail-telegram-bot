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
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.imap.connect();
      logger.info("IMAP connection established");
      this.startMonitoring();
    } catch (err) {
      logger.error("IMAP connection error:", err);
      this.reconnect();
    }
  }

  end(): void {
    this.imap.logout();
  }

  private async reconnect(): Promise<void> {
    logger.info("Attempting to reconnect to IMAP server...");
    setTimeout(() => {
      this.connect();
    }, 10000);
  }

  private async startMonitoring(): Promise<void> {
    const lock = await this.imap.getMailboxLock("INBOX");

    const onNewEmail = (...args: unknown[]) => {
      logger.child({ args }).info("New email event");
      this.checkNewEmails();
    };

    try {
      await this.checkNewEmails();  // first check

      this.imap.on("exists", onNewEmail);

      while (true) {
        try {
          await this.imap.idle();
        } catch (err) {
          logger.error("Error in idle: %s", err);
        }
      }
    } finally {
      this.imap.off("exists", onNewEmail);
      lock.release();
    }
  }

  private async checkNewEmails(): Promise<void> {
    try {
      const targetEmails = config.monitoring.targetEmails;

      for await (const msg of this.imap.fetch(
        { seen: false },
        {
          envelope: true,
          bodyStructure: true,
        }
      )) {
        await this.processMessage(msg, targetEmails);
      }
    } catch (err) {
      logger.error("Error in checkNewEmails: %s", err);
    }
  }

  private async processMessage(
    msg: FetchMessageObject,
    targetEmails: string[]
  ): Promise<void> {
    try {
      logger.child({
        envelope: msg.envelope,
        seq: msg.seq,
        threadId: msg.threadId,
      }).info("envelope");

      const isTargetEmail = msg.envelope.to.some(
        (email) => email.address && targetEmails.includes(email.address)
      );
      if (!isTargetEmail) {
        logger.child({
          envelope: msg.envelope,
          seq: msg.seq,
        }).info("Email is not for monitoring");
        return;
      }

      // mark this message as seen, so it won't be processed again
      await this.imap.messageFlagsAdd(
        {
          threadId: msg.threadId,
        },
        ["\\Seen"]
      );

      const { content } = await this.imap.download(msg.seq.toString());
      const textStr = await this.readableToString(content);

      const cleanedText = emailToText(textStr);

      const emailData: EmailData = {
        subject: msg.envelope.subject,
        recipient: msg.envelope.to[0].address ?? "",
        date: msg.envelope.date,
        content: cleanedText,
      };

      this.emit("newEmail", emailData);
      logger.child({ emailData }).info("New email processed");
    } catch (err) {
      logger.error("Error processing message: %s", err);
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
