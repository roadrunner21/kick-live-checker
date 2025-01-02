// constants.ts
import path from 'path';
import { Logger } from "winston";

// Create a central tmp directory configuration
const TMP_DIR = path.join(__dirname, '..', 'tmp');

// URLs
export const BASE_URL = 'https://kick.com';
export const CLIPS_URL = `${BASE_URL}/api/v2/clips`;

// Browser Configuration
export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--start-maximized',
  '--disable-infobars',
  '--disable-dev-shm-usage',
];

// File Paths
export const PATHS = {
  TMP_DIR,
  RESPONSES: {
    LAST_RESPONSE: path.join(TMP_DIR, 'last_response.html'),
    ERROR_RESPONSE: path.join(TMP_DIR, 'error_response.html'),
  },
  LOGS: path.join(TMP_DIR, 'logs'),
} as const;

// Ensure all necessary directories exist
import { mkdirSync } from 'fs';
export const ensureTmpDirectories = () => {
  mkdirSync(PATHS.TMP_DIR, { recursive: true });
  mkdirSync(PATHS.LOGS, { recursive: true });
};

// Data Interfaces (unchanged)
export interface StreamerData {
  name: string;
  id: string;
  link: string;
  profilePicture: string;
}

export interface ClipData {
  clipId: string;
  title: string;
  views: number;
  link: string;
  timestamp: string;
  duration: string;
  category: string;
  createdAt: string;
  thumbnail: string;
  streamer: StreamerData;
}

export interface ChannelPageData {
  channelUrl: string;
  channelName: string;
  title: string;
}

export interface ScraperOptions {
  customLogger?: Logger;
  enableLogging?: boolean;
  scrapeClips?: boolean;
}