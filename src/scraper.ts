import { BASE_URL, CLIPS_URL } from './constants';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { Logger } from 'winston';
import { initializeLogger } from './logger';

// Interfaces
export interface ScraperOptions {
  customLogger?: Logger;
  enableLogging?: boolean;
  scrapeClips?: boolean;
}

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

// Constants
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const LAST_RESPONSE_FILE = path.join(__dirname, '..', 'last_response.html');
const ERROR_RESPONSE_FILE = path.join(__dirname, '..', 'error_response.html');

export async function scrapeKickPage(
  options: ScraperOptions = {}
): Promise<ClipData[] | ChannelPageData> {
  const logger = initializeLogger(options);

  // Determine the URL based on options
  const url = options.scrapeClips ? CLIPS_URL : `${BASE_URL}/browse`;
  logger.info(`Navigating to ${options.scrapeClips ? 'Clips' : 'Browse'} page at ${url}`);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US' });

    await page.goto(url, { waitUntil: 'networkidle2' });

    const content = await page.content();
    fs.writeFileSync(LAST_RESPONSE_FILE, content, 'utf8');
    logger.info(`Page content saved to ${LAST_RESPONSE_FILE}`);

    if (options.scrapeClips) {
      // Scrape clip data
      const clips = await page.evaluate(() => {
        const clipCards = document.querySelectorAll('.group\\/card.relative.flex.w-full.shrink-0.grow-0.flex-col.gap-2');

        return Array.from(clipCards).map((card) => {
          const duration = card.querySelector('.z-controls.top-1\\.5.left-1\\.5')?.textContent?.trim() || '';
          const viewsElement = card.querySelector('.z-controls.bottom-1\\.5.left-1\\.5 span[title]');
          const views = parseInt(viewsElement?.getAttribute('title') || '0', 10);
          const thumbnail = card.querySelector('img[data-thumbnail="true"]')?.getAttribute('src') || '';
          const linkAnchor = card.querySelector('a[href*="/clips/clip_"]');
          const link = linkAnchor?.getAttribute('href') || '';
          const title = linkAnchor?.getAttribute('title') || linkAnchor?.textContent?.trim() || '';
          const categoryAnchor = card.querySelector('a[href*="/category/"]');
          const category = categoryAnchor?.textContent?.trim() || '';
          const dateAnchor = card.querySelector('a[href*="/clips/clip_"] span[title]');
          const createdAt = dateAnchor?.getAttribute('title') || '';
          const streamerAnchor = card.querySelector('a[href^="/"]');
          const streamerName = streamerAnchor?.textContent?.trim() || '';
          const streamerId = streamerAnchor?.getAttribute('href')?.replace('/', '') || '';
          const profilePicture = streamerAnchor?.querySelector('img')?.getAttribute('src') || '';

          return {
            clipId: link.split('/').pop() || '',
            title,
            views,
            link: `https://kick.com${link}`,
            timestamp: createdAt, // Relative or absolute timestamp
            duration,
            category,
            createdAt,
            thumbnail, // Thumbnail URL
            streamer: {
              name: streamerName,
              id: streamerId,
              link: `https://kick.com/${streamerId}`,
              profilePicture,
            },
          };
        });
      });

      await browser.close();
      logger.info(`Scraped ${clips.length} clips successfully.`);
      return clips;
    } else {
      // Return placeholder `ChannelPageData` if not scraping clips
      await browser.close();
      return {
        channelUrl: url,
        channelName: 'Placeholder Channel',
        title: 'Placeholder Title',
      };
    }
  } catch (error: any) {
    logger.error(`Error scraping page: ${error.message}`);
    fs.writeFileSync(ERROR_RESPONSE_FILE, error.message, 'utf8');
    throw error;
  }
}
