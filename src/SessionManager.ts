import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Logger } from 'winston';
import { initializeLogger } from './logger';
import { USER_AGENT, BROWSER_ARGS, RESPONSE_FILES } from './constants';
import fs from 'fs';

puppeteer.use(StealthPlugin());

// Error Classes
export class SessionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'SessionError';
  }
}

export class CloudflareError extends SessionError {
  constructor(message: string = 'Cloudflare challenge detected', cause?: Error) {
    super(message, cause);
    this.name = 'CloudflareError';
  }
}

// Interfaces
export interface CapturedRequestInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
}

export interface RequestResponse {
  status: number;
  statusText: string;
  body: string;
}

export class SessionManager {
  private browser?: Browser;
  private page?: Page;
  private logger: Logger;
  private capturedRequestInfo: CapturedRequestInfo | null = null;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger || initializeLogger();
  }

  private async resolveCloudflare(): Promise<void> {
    if (!this.page) throw new SessionError('No page available');

    this.logger.debug('Checking for Cloudflare challenge...');
    const pageTitle = await this.page.title();

    if (pageTitle.includes('Just a moment')) {
      this.logger.warn('Cloudflare detected: Page title contains "Just a moment." Waiting 2s for possible redirect...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const hasChallengeText = await this.page.evaluate(() => {
        const paragraph = document.querySelector('p');
        if (!paragraph) return false;
        return paragraph.textContent?.includes('Verify you are human by completing the action below') || false;
      });

      if (hasChallengeText) {
        this.logger.error('Cloudflare challenge found: "Verify you are human..." text is present.');
        throw new CloudflareError();
      }
    }

    this.logger.debug('No Cloudflare challenge detected.');
  }

  private async autoScroll(maxScrolls: number): Promise<void> {
    if (!this.page) throw new SessionError('No page available');

    this.logger.debug('Starting autoScroll...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      await this.page.evaluate(
        async (scrollLimit: number) => {
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
      this.logger.error('Error in autoScroll:', err);
      throw new SessionError('Auto scroll failed', err instanceof Error ? err : undefined);
    }
  }

  private async setupRequestInterception(): Promise<void> {
    if (!this.page) throw new SessionError('No page available');

    await this.page.setRequestInterception(true);

    this.page.on('console', (msg) => {
      this.logger.debug(`BROWSER LOG: ${msg.type()} => ${msg.text()}`);
    });

    this.page.on('request', async (req) => {
      if (req.url().includes('/api/v2/clips')) {
        this.logger.debug(`[REQUEST INTERCEPTED] ${req.method()} => ${req.url()}`);

        this.capturedRequestInfo = {
          url: req.url(),
          method: req.method(),
          headers: { ...req.headers() },
          postData: req.postData(),
        };

        this.logger.debug(
          `Intercepted Headers: ${JSON.stringify(this.capturedRequestInfo.headers, null, 2)}`
        );
      }
      req.continue();
    });

    this.page.on('response', async (res) => {
      if (res.url().includes('/api/v2/clips')) {
        try {
          const textBody = await res.text();
          this.logger.debug(`[RESPONSE] => ${res.url()} [Status: ${res.status()}]`);
          this.logger.debug(`Body snippet: ${textBody.slice(0, 300)}...`);
        } catch (err) {
          this.logger.warn(`Failed to parse response from ${res.url()}. Error: ${err}`);
        }
      }
    });
  }

  async createNewSession(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: BROWSER_ARGS,
      });

      this.page = await this.browser.newPage();
      await this.setupRequestInterception();

      await this.page.setUserAgent(USER_AGENT);
      await this.page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9,en;q=0.8' });

    } catch (error) {
      await this.dispose();
      throw new SessionError(
        'Failed to create new session',
        error instanceof Error ? error : undefined
      );
    }
  }

  async navigateToPage(url: string): Promise<void> {
    if (!this.page) throw new SessionError('No page available');

    this.logger.debug(`Navigating to ${url}...`);
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    await this.resolveCloudflare();
    await this.autoScroll(50);

    const htmlContent = await this.page.content();
    fs.writeFileSync(RESPONSE_FILES.LAST_RESPONSE, htmlContent, 'utf8');
    this.logger.debug(`Saved HTML content to ${RESPONSE_FILES.LAST_RESPONSE}`);
  }

  async makeRequest(url: string, method: string, headers?: Record<string, string>, body?: string | null): Promise<RequestResponse> {
    if (!this.page) throw new SessionError('No page available');

    try {
      const result = await this.page.evaluate(
        async (fetchUrl, fetchMethod, fetchHeaders, fetchBody) => {
          try {
            const response = await fetch(fetchUrl, {
              method: fetchMethod,
              headers: fetchHeaders || {},
              body: (fetchMethod === 'POST' || fetchMethod === 'PUT') && fetchBody ? fetchBody : null,
            });
            const responseBody = await response.text();
            return {
              status: response.status,
              statusText: response.statusText,
              body: responseBody,
            };
          } catch (err) {
            return { error: (err as Error).message };
          }
        },
        url,
        method,
        headers || {},
        body || null
      );

      if ('error' in result && result.error) {
        throw new SessionError(result.error);
      } else if ('error' in result) {
        throw new SessionError('Unknown request error');
      }

      return result as RequestResponse;
    } catch (error) {
      throw new SessionError(
        'Failed to make request',
        error instanceof Error ? error : undefined
      );
    }
  }

  async ensureValidSession(): Promise<void> {
    if (!this.browser || !this.page) {
      await this.createNewSession();
    }
  }

  getCapturedRequest(): CapturedRequestInfo | null {
    return this.capturedRequestInfo;
  }

  async dispose(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
  }
}