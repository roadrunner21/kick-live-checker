// src/index.ts
import { Logger } from 'winston';
import { Api } from './Api';
import { SessionManager, SessionError, CloudflareError } from './SessionManager';
import { initializeLogger } from './logger';
import { GetClipsResponse, Clip } from './types/ClipResponse';
import { EndpointParams } from './types/ApiTypes';
import { ApiEndpoints } from './apiEndpoints';

// Define specific types for clip parameters
export type ClipSortOption = typeof ApiEndpoints.clips.params.sort[number];
export type ClipTimeOption = typeof ApiEndpoints.clips.params.time[number];

// Create a type-safe parameter interface
export interface ClipParams {
  sort?: ClipSortOption;
  time?: ClipTimeOption;
}

export interface KickScraperOptions {
  debug?: boolean;
  logger?: Logger;
}

// Constants for available options
export const ClipOptions = {
  sort: ApiEndpoints.clips.params.sort,
  time: ApiEndpoints.clips.params.time
} as const;

export class KickScraper {
  private api: Api;
  private sessionManager: SessionManager;
  private logger: Logger;

  constructor(options: KickScraperOptions = {}) {
    this.logger = options.logger || initializeLogger({ enableLogging: options.debug });
    this.sessionManager = new SessionManager({ logger: this.logger });
    this.api = new Api(this.sessionManager, { logger: this.logger });
  }

  /**
   * Get clips from Kick.com
   * @param params Configuration for the clips request
   * @param params.sort Sort clips by: 'view' | 'recent' | 'trending'
   * @param params.time Time period: 'day' | 'week' | 'month' | 'all'
   * @param limit Optional limit for the number of clips to retrieve
   */
  async getClips(params: ClipParams = {}, limit?: number): Promise<GetClipsResponse> {
    try {
      // Set default values if not provided
      const finalParams: EndpointParams<'clips'> = {
        sort: params.sort || 'view',
        time: params.time || 'day'
      };

      if (limit && limit > 0) {
        return await this.api.getClipsWithLimit(finalParams, limit);
      }
      return await this.api.getClips(finalParams);
    } finally {
      await this.sessionManager.dispose();
    }
  }
}

// Export everything that might be needed by consumers
export {
  SessionError,
  CloudflareError,
  type GetClipsResponse,
  type Clip,
  type EndpointParams,
};