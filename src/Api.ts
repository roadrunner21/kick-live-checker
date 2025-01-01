import { Logger } from 'winston';
import { initializeLogger } from './logger';
import { BASE_URL } from './constants';
import { SessionManager, SessionError } from './SessionManager';
import { GetClipsResponse } from "./types/ClipResponse";
import { UrlBuilder } from './urlBuilder';
import { EndpointParams } from "./types/ApiTypes";

export class Api {
  private sessionManager: SessionManager;
  private logger: Logger;
  private urlBuilder: UrlBuilder;

  constructor(sessionManager: SessionManager, options?: { logger?: Logger }) {
    this.sessionManager = sessionManager;
    this.logger = options?.logger || initializeLogger();
    this.urlBuilder = new UrlBuilder('https://kick.com');
  }

  async getClips(params: EndpointParams<'clips'>): Promise<GetClipsResponse> {
    try {
      await this.sessionManager.ensureValidSession();

      const url = this.urlBuilder.buildUrl('clips', params);
      await this.sessionManager.navigateToPage(url);

      const capturedRequest = this.sessionManager.getCapturedRequest();
      if (!capturedRequest) {
        throw new SessionError('No API request to /api/v2/clips was captured.');
      }

      const response = await this.sessionManager.makeRequest(
        url,
        capturedRequest.method,
        capturedRequest.headers,
        capturedRequest.postData || null
      );

      this.logger.debug(`[API Response] Status: ${response.status} ${response.statusText}`);
      return JSON.parse(response.body) as GetClipsResponse;
    } catch (error) {
      throw new SessionError('Failed to get clips', error instanceof Error ? error : undefined);
    }
  }
}