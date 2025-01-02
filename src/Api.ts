// api.ts
import { Logger } from 'winston';
import { initializeLogger } from './logger';
import { BASE_URL } from './constants';
import {
  SessionManager,
  SessionError
} from './SessionManager';
import {
  GetClipsResponse,
  Clip
} from "./types/ClipResponse";
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

  async getClips(params: EndpointParams<'clips'>, requestNumber?: number): Promise<GetClipsResponse> {
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
      let finalResponse: GetClipsResponse = JSON.parse(response.body);

      // Enhanced logging with request number if provided
      const requestLabel = requestNumber ? `[Request ${requestNumber}]` : '';
      console.log(`${requestLabel} Count clips: ${finalResponse.clips.length}`);
      if (finalResponse.nextCursor) {
        console.log(`${requestLabel} Next cursor: ${finalResponse.nextCursor}`);
      }

      return finalResponse;
    } catch (error) {
      throw new SessionError('Failed to get clips', error instanceof Error ? error : undefined);
    }
  }

  async getClipsWithLimit(params: EndpointParams<'clips'>, limit: number = 20): Promise<GetClipsResponse> {
    console.log(`\nFetching up to ${limit} clips...`);

    let response: GetClipsResponse = {
      clips: [],
      nextCursor: null
    };

    let currentCursor: string | null = null;
    const requestsNeeded = Math.ceil(limit / 20);

    for (let i = 0; i < requestsNeeded && response.clips.length < limit; i++) {
      const currentParams = {
        ...params,
        ...(currentCursor ? {cursor: currentCursor} : {})
      };

      console.log(`\nMaking request ${i + 1} of up to ${requestsNeeded}...`);
      const newResponse = await this.getClips(currentParams, i + 1);

      // Merge the new clips with existing ones
      response.clips = [
        ...response.clips,
        ...newResponse.clips
      ];

      // Update the cursor for the next iteration
      currentCursor = newResponse.nextCursor;
      response.nextCursor = currentCursor;

      console.log(`Total clips so far: ${response.clips.length}`);

      // If there's no next cursor, we've reached the end
      if (!currentCursor) {
        console.log('No more clips available from the API');
        break;
      }
    }

    // Trim to exact limit if we went over
    if (response.clips.length > limit) {
      response.clips = response.clips.slice(0, limit);
      console.log(`Trimmed result to ${limit} clips as requested`);
    }

    console.log(`\nFetch complete. Retrieved ${response.clips.length} clips total\n`);
    return response;
  }
}