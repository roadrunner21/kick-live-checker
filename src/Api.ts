import { Logger } from 'winston';
import { initializeLogger } from './logger';
import { BASE_URL } from './constants';
import { SessionManager, SessionError } from './SessionManager';

export class Api {
  private sessionManager: SessionManager;
  private logger: Logger;

  constructor(sessionManager: SessionManager, options?: { logger?: Logger }) {
    this.sessionManager = sessionManager;
    this.logger = options?.logger || initializeLogger();
  }

  async getClips(params: { sort: string, range: string }): Promise<void> {
    try {
      await this.sessionManager.ensureValidSession();

      const url = `${BASE_URL}/browse/clips?sort=${params.sort}&range=${params.range}`;
      await this.sessionManager.navigateToPage(url);

      const capturedRequest = this.sessionManager.getCapturedRequest();
      if (!capturedRequest) {
        this.logger.warn('No API request to /api/v2/clips was captured.');
        return;
      }

      const response = await this.sessionManager.makeRequest(
        capturedRequest.url,
        capturedRequest.method,
        capturedRequest.headers,
        capturedRequest.postData || null
      );

      this.logger.info(`[API Response] Status: ${response.status} ${response.statusText}`);
      this.logger.info(`[API Response] Body snippet: ${response.body.slice(0, 300)}...`);

    } catch (error) {
      throw new SessionError(
        'Failed to get clips',
        error instanceof Error ? error : undefined
      );
    }
  }
}