export interface EmailData {
  subject: string;
  recipient: string;
  date: Date;
  content: string;
}

export interface IMAPConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  tlsOptions: {
    rejectUnauthorized: boolean;
  };
}

export interface TelegramConfig {
  token: string;
  channelId: string;
}

export interface MonitoringConfig {
  targetEmails: string[];
  checkInterval: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface AppConfig {
  imap: IMAPConfig;
  telegram: TelegramConfig;
  monitoring: MonitoringConfig;
  rateLimit: RateLimitConfig;
}
