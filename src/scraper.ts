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
      pkgLogger.info('Starting Puppeteer fetch operation...');
      const result = await replicateClipApiRequestFetchPuppeteer(
        page,
        capturedRequestInfo.url,
        capturedRequestInfo.method,
        capturedRequestInfo.headers,
        capturedRequestInfo.postData || null,
        logger
      );
      pkgLogger.info('Puppeteer fetch operation completed.');
    }

    pkgLogger.info('Closing browser after scraping...');
    await page.waitForNetworkIdle({
      // Puppeteer has a built-in waitForNetworkIdle in some versions,
      // or a combination of waitForRequest/waitForResponse approach
      idleTime: 2000, // Wait for 2 seconds of no network traffic
      timeout: 10000,
    });

// Then close the browser
    await browser.close();
  } catch (err: any) {
    pkgLogger.error(`Error in testClipApi: ${err.message}`);
    throw err;
  }
}

/**
 * Replicates the Puppeteer / Browser request as a fetch call
 */
async function replicateClipApiRequestFetchPuppeteer(
  page: Page,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  logger: Logger | undefined
): Promise<void> {
  const log = logger || initializeLogger(); // Fallback to default logger if `logger` is undefined
  try {
    const result = await page.evaluate(
      async (fetchUrl, fetchMethod, fetchHeaders, fetchBody) => {
        try {
          const response = await fetch(fetchUrl, {
            method: fetchMethod,
            headers: fetchHeaders,
            body: fetchMethod === 'POST' || fetchMethod === 'PUT' ? fetchBody : null,
          });
          const responseBody = await response.text();
          return {
            status: response.status,
            statusText: response.statusText,
            body: responseBody,
          };
        } catch (err) {
          return { error: (err as Error).message }; // Explicitly cast `err` as Error
        }
      },
      url,
      method,
      headers,
      body
    );

    if (result.error) {
      log.error(`[Puppeteer Fetch] Error: ${result.error}`);
    } else {
      log.info(`[Puppeteer Fetch] Status: ${result.status} ${result.statusText}`);
      log.info(`[Puppeteer Fetch] Response Body Snippet: ${result.body?.slice(0, 300)}...`);
    }
  } catch (error) {
    log.error(`Failed to replicate request with Puppeteer fetch. Error: ${(error as Error).message}`);
  }
}