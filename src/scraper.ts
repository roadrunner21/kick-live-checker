import { BASE_URL, CLIPS_URL } from './constants';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { Logger } from 'winston';
import { initializeLogger } from './logger';
import axios from "axios";
import { Page } from "puppeteer";

puppeteer.use(StealthPlugin());

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
async function autoScroll(page: Page, maxScrolls: number): Promise<void> {
  console.log('Starting autoScroll...');
  // Wait for 3 seconds before starting the scrolling
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('Waited 3 seconds before starting scrolling.');

  try {
    // Log some relevant metrics before going into page.evaluate
    const { width, height } = (await page.viewport()) || { width: null, height: null };
    console.log(`Viewport width: ${width}, height: ${height}`);

    // Evaluate scroll logic in the browser context
    await page.evaluate(
      async (scrollLimit: number) => {
        console.log('Inside page.evaluate for scrolling...');

        // Grab the container by ID
        const container = document.querySelector<HTMLElement>('#main-container');
        if (!container) {
          console.log('No element found with ID #main-container');
          return;
        }

        // Log container-side metrics before scrolling
        console.log(`container.scrollHeight: ${container.scrollHeight}`);
        console.log(`container.clientHeight: ${container.clientHeight}`);

        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          let scrollCount = 0;

          const timer = setInterval(() => {
            // Each iteration, log key metrics
            console.log(`\nScroll iteration: ${scrollCount + 1}`);
            const scrollHeight = container.scrollHeight;
            console.log(`  scrollHeight: ${scrollHeight}`);
            console.log(`  totalHeight so far: ${totalHeight}`);
            console.log(`  container.clientHeight: ${container.clientHeight}`);

            // Perform the actual scroll on the container
            container.scrollBy(0, distance);
            totalHeight += distance;
            scrollCount++;

            // Evaluate if we've reached bottom or exceeded scroll limit
            const bottomReached = totalHeight >= (scrollHeight - container.clientHeight);
            const limitReached = scrollCount >= scrollLimit;

            console.log(
              `  bottomReached=${bottomReached}, limitReached=${limitReached}`
            );

            if (bottomReached || limitReached) {
              console.log(`Stopping scroll at iteration ${scrollCount}...`);
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });

        console.log('Completed scrolling inside page.evaluate.');
      },
      maxScrolls
    );
  } catch (err) {
    console.error('Error in autoScroll:', err);
  }
  console.log('Completed autoScroll function.');
}

export async function testClipApi(logger?: Logger): Promise<void> {
  const pkgLogger = logger || initializeLogger();
  const testUrl = `${BASE_URL}/browse/clips?sort=view&range=day`;

  try {
    pkgLogger.info('Launching Puppeteer in GUI mode with stealth plugin...');

    // Launch in headful mode for debugging
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: {
        width: 1280,
        height: 800,
      },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // Forward browser console logs to Node
    page.on('console', (msg) => {
      console.log(`BROWSER LOG: ${msg.type()} => ${msg.text()}`);
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9,en;q=0.8' });

    // Intercept requests/responses to /api/v2/clips
    page.on('request', (req) => {
      if (req.url().includes('/api/v2/clips')) {
        pkgLogger.info(`[REQUEST] ${req.method()} => ${req.url()}`);
        pkgLogger.info(`Request Headers: ${JSON.stringify(req.headers(), null, 2)}`);
      }
    });
    page.on('response', async (res) => {
      if (res.url().includes('/api/v2/clips')) {
        try {
          const textBody = await res.text();
          pkgLogger.info(`[RESPONSE] => ${res.url()} [Status: ${res.status()}]`);
          pkgLogger.info(`Body snippet: ${textBody.slice(0, 300)}...`);
        } catch (err) {
          pkgLogger.warn(`Failed to parse response from ${res.url()}. Error: ${err}`);
        }
      }
    });

    pkgLogger.info(`Navigating to ${testUrl}...`);
    await page.goto(testUrl, { waitUntil: 'networkidle2' });

    pkgLogger.info('Performing scrolling...');
    await autoScroll(page, 50);

    const htmlContent = await page.content();
    fs.writeFileSync(LAST_RESPONSE_FILE, htmlContent, 'utf8');
    pkgLogger.info(`Saved HTML content to ${LAST_RESPONSE_FILE}`);

    const allCookies = await page.cookies();
    const cookieString = allCookies.map((c) => `${c.name}=${c.value}`).join('; ');
    pkgLogger.info(`Collected Cookies:\n${cookieString}`);

    pkgLogger.info('Browser will remain open for manual inspection. Close it manually to terminate.');
    await new Promise(() => {}); // Keep script alive
  } catch (err: any) {
    pkgLogger.error(`Error in testClipApi: ${err.message}`);
    throw err;
  }
}