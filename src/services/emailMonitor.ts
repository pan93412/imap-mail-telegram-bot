import { EventEmitter } from 'events';
import Imap from 'imap';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import type { EmailData } from '../types';
import { htmlToText } from 'html-to-text';

export declare interface EmailMonitor {
  on(event: 'newEmail', listener: (data: EmailData) => void): this;
  emit(event: 'newEmail', data: EmailData): boolean;
}

export class EmailMonitor extends EventEmitter {
  private imap: Imap;

  constructor() {
    super();
    this.imap = new Imap(config.imap);
    this.setupEventHandlers();
  }

  end(): void {
    this.imap.end();
  }

  private setupEventHandlers(): void {
    this.imap.once('ready', () => {
      logger.info('IMAP connection established');
      this.startMonitoring();
    });

    this.imap.once('error', (err: Error) => {
      logger.error('IMAP connection error:', err);
      this.reconnect();
    });

    this.imap.once('end', () => {
      logger.info('IMAP connection ended');
      this.reconnect();
    });
  }

  private reconnect(): void {
    logger.info('Attempting to reconnect to IMAP server...');
    setTimeout(() => {
      this.connect();
    }, 10000);
  }

  public connect(): void {
    try {
      this.imap.connect();
    } catch (err) {
      logger.error('Failed to connect to IMAP:', err);
      this.reconnect();
    }
  }

  private async startMonitoring(): Promise<void> {
    try {
      this.imap.openBox('INBOX', false, (err) => {
        if (err) {
          logger.error('Error opening inbox:', err);
          return;
        }

        this.imap.on('mail', () => this.checkNewEmails());
        this.checkNewEmails(); // Initial check
      });
    } catch (err) {
      logger.error('Error in startMonitoring:', err);
    }
  }

  private async checkNewEmails(): Promise<void> {
    try {
      const targetEmails = config.monitoring.targetEmails;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      this.imap.search(['UNSEEN', ['SINCE', yesterday]], (err, results) => {
        if (err) {
          logger.error('Error searching emails:', err);
          return;
        }

        if (!results.length) return;

        const fetch = this.imap.fetch(results, {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
          markSeen: true
        });

        fetch.on('message', (msg) => {
          this.processMessage(msg, targetEmails);
        });

        fetch.once('error', (err) => {
          logger.error('Fetch error:', err);
        });
      });
    } catch (err) {
      logger.error('Error in checkNewEmails:', err);
    }
  }

  private async processMessage(msg: Imap.ImapMessage, targetEmails: string[]): Promise<void> {
    let headerInfo: Record<string, string[]> = {};
    let textBuffer = '';

    msg.on('body', (stream, info) => {
      if (info.which === 'TEXT') {
        stream.on('data', (chunk: Buffer) => {
          textBuffer += chunk.toString('utf8');
        });
      } else {
        stream.on('data', (chunk: Buffer) => {
          headerInfo = Imap.parseHeader(chunk.toString('utf8'));
        });
      }
    });

    msg.once('end', async () => {
      logger.info('Processing message:', { headerInfo, textBuffer });

      try {
        const to = headerInfo.to?.[0] || '';
        if (!targetEmails.some(email => to.includes(email))) {
          return;
        }

        const cleanedText = htmlToText(textBuffer);

        const emailData: EmailData = {
          subject: headerInfo.subject?.[0] || 'No Subject',
          recipient: to,
          date: new Date(headerInfo.date?.[0] || Date.now()),
          content: cleanedText,
        };

        this.emit('newEmail', emailData);
        logger.info('New email processed', { subject: emailData.subject });
      } catch (err) {
        logger.error('Error processing message:', err);
      }
    });
  }
}
