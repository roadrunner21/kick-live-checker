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

interface CapturedRequestInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
}

// Constants
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const LAST_RESPONSE_FILE = path.join(__dirname, '..', 'last_response.html');
const ERROR_RESPONSE_FILE = path.join(__dirname, '..', 'error_response.html');

// We'll store the entire request info here
let capturedRequestInfo: CapturedRequestInfo | null = null;

export async function resolveCloudflare(page: Page, logger: Logger): Promise<boolean> {
  logger.info('Checking for Cloudflare challenge...');

  // 1. Check the page title for the common "Just a moment" Cloudflare message.
  const pageTitle = await page.title();
  if (pageTitle.includes('Just a moment')) {
    logger.warn('Cloudflare detected: Page title contains "Just a moment." Waiting 2s for possible redirect...');

    // 2. Wait a bit in case Cloudflare auto-redirects the user after verification.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Check for the challenge paragraph text on the page.
    const hasChallengeText = await page.evaluate(() => {
      const paragraph = document.querySelector('p');
      if (!paragraph) return false;
      return paragraph.textContent?.includes('Verify you are human by completing the action below') || false;
    });

    if (hasChallengeText) {
      logger.error('Cloudflare challenge found: "Verify you are human..." text is present. Aborting...');
      return false;
    }
  }

  // If we got here, Cloudflare challenge was not detected.
  logger.info('No Cloudflare challenge detected.');
  return true;
}
// ------------------------------------------------------------------------- //

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
    await page.evaluate(
      async (scrollLimit: number) => {
        // Target the scrollable container
        const container = document.querySelector<HTMLElement>('#main-container');
        if (!container) {
          console.error('Error: No element found with ID #main-container');
          return;
        }

        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          let scrollCount = 0;

          const timer = setInterval(() => {
            scrollCount++;
            container.scrollBy(0, distance);
            totalHeight += distance;

            const bottomReached = totalHeight >= (container.scrollHeight - container.clientHeight);
            const limitReached = scrollCount >= scrollLimit;

            console.log(`Scroll step: ${scrollCount}, Bottom reached: ${bottomReached}`);

            if (bottomReached || limitReached) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
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
    pkgLogger.info('Launching Puppeteer with stealth plugin...');

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--disable-infobars',
        '--disable-dev-shm-usage',
      ],
    });
    const page = await browser.newPage();

    // -------------------------------------
    // 1) Enable request interception so we can see ALL headers (including sec-ch-*, etc.)
    // -------------------------------------
    await page.setRequestInterception(true);

    page.on('console', (msg) => {
      console.log(`BROWSER LOG: ${msg.type()} => ${msg.text()}`);
    });

    page.on('request', async (req) => {
      // Let the request continue no matter what, but capture relevant data if it’s the /api/v2/clips endpoint
      if (req.url().includes('/api/v2/clips')) {
        pkgLogger.info(`[REQUEST INTERCEPTED] ${req.method()} => ${req.url()}`);

        capturedRequestInfo = {
          url: req.url(),
          method: req.method(),
          headers: { ...req.headers() }, // copy the raw headers
          postData: req.postData(),
        };

        pkgLogger.info(
          `Intercepted Headers: ${JSON.stringify(capturedRequestInfo.headers, null, 2)}`
        );
      }

      // Important: must continue the request or Puppeteer will block
      req.continue();
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

    // -------------------------------------
    // Set some essential headers
    // -------------------------------------
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9,en;q=0.8' });

    pkgLogger.info(`Navigating to ${testUrl}...`);
    await page.goto(testUrl, { waitUntil: 'networkidle2' });

    // (Your existing Cloudflare resolution logic, if any)
    const resolved = await resolveCloudflare(page, pkgLogger);
    if (!resolved) {
      pkgLogger.warn('Aborting due to Cloudflare challenge.');
      await browser.close();
      return;
    }

    pkgLogger.info('Performing scrolling...');
    await autoScroll(page, 50);

    const htmlContent = await page.content();
    fs.writeFileSync(LAST_RESPONSE_FILE, htmlContent, 'utf8');
    pkgLogger.info(`Saved HTML content to ${LAST_RESPONSE_FILE}`);

    // -------------------------------------
    // 2) Capture final cookies as they stand in the browser
    // -------------------------------------
    const allCookies = await page.cookies();
    const cookieString = allCookies.map((c) => `${c.name}=${c.value}`).join('; ');
    pkgLogger.info(`Collected Cookies:\n${cookieString}`);

    // -------------------------------------
    // 3) Now replicate the request with Axios
    // -------------------------------------
    if (!capturedRequestInfo) {
      pkgLogger.warn('No API request to /api/v2/clips was captured.');
    } else {
      pkgLogger.info('Replicating the captured request with Axios...');
      await replicateClipApiRequest(
        capturedRequestInfo.url,
        capturedRequestInfo.method,
        capturedRequestInfo.headers,
        cookieString,
        capturedRequestInfo.postData || null,
        pkgLogger
      );
    }

    pkgLogger.info('Closing browser after scraping...');
    await browser.close();
  } catch (err: any) {
    pkgLogger.error(`Error in testClipApi: ${err.message}`);
    throw err;
  }
}

/**
 * This function attempts to replicate the Puppeteer request EXACTLY.
 * We inject:
 *   - the same method (GET, POST, etc.)
 *   - the same headers (plus any forced overrides)
 *   - the same cookies
 *   - any post data (for POST, PUT, etc.)
 */
async function replicateClipApiRequest(
  url: string,
  method: string,
  originalHeaders: Record<string, string>,
  cookieString: string,
  postData: string | null,
  logger: Logger
): Promise<void> {
  try {
    // Start with the raw headers from Puppeteer’s interception
    const finalHeaders: Record<string, string> = { ...originalHeaders };

    // Force some known “important” overrides if needed
    // e.g. Kick often requires full acceptance and same user-agent
    finalHeaders['User-Agent'] = finalHeaders['user-agent'] || finalHeaders['User-Agent'] || '';
    finalHeaders['Accept'] = finalHeaders['accept'] || '*/*'; // or 'application/json, text/plain, */*'
    finalHeaders['Cookie'] = cookieString; // The big one: ensure we pass the final browser cookies
    finalHeaders['Accept-Language'] ||= 'en-GB,en;q=0.9,en;q=0.8';
    finalHeaders['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A.Brand";v="24"';
    finalHeaders['sec-ch-ua-mobile'] = '?0';
    finalHeaders['sec-ch-ua-platform'] = '"macOS"';
    finalHeaders['sec-fetch-dest'] = 'empty';
    finalHeaders['sec-fetch-mode'] = 'cors';
    finalHeaders['sec-fetch-site'] = 'same-origin';
    finalHeaders['rsc'] = '1';
    finalHeaders['priority'] = 'u=1, i';

    // If the site uses DNT or sec-ch- headers from cURL:
    // Make sure they exist or set them forcibly (if `request.headers()` didn’t pick them up)
    if (!finalHeaders['dnt']) {
      finalHeaders['dnt'] = '1';
    }
    // same logic for any others like 'sec-ch-ua', 'sec-ch-ua-mobile', etc.

    // Clean up leftover lower-cased keys vs. Title-Case
    // (Axios is okay with either, but some servers can be picky.)
    // Usually it's fine to leave them as-lowercased though.

    logger.info(`Making replicated ${method} request to ${url} with Axios...`);
    logger.info(`Headers to be sent:\n${JSON.stringify(finalHeaders, null, 2)}`);

    const axiosConfig = {
      url,
      method: method.toLowerCase() as 'get' | 'post' | 'put' | 'delete',
      headers: finalHeaders,
      // If it was a POST or PUT, we’d supply `data: postData`,
      // but for GET / HEAD, typically not needed
    } as any;

    if (method.toUpperCase() !== 'GET' && postData) {
      axiosConfig.data = postData;
    }

    const response = await axios(axiosConfig);
    logger.info(`[Axios Response] Status: ${response.status}`);
    logger.info(
      `[Axios Response Body]: ${JSON.stringify(response.data, null, 2).slice(0, 300)}...`
    );
  } catch (error: any) {
    logger.error(`Failed to replicate request with Axios. Error: ${error.message}`);
  }
}