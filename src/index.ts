// src/index.ts
import { Logger } from 'winston';
import { Api } from './Api';
import { SessionManager, SessionError, CloudflareError } from './SessionManager';
import { initializeLogger } from './logger';
import { GetClipsResponse, Clip } from './types/ClipResponse';
import { EndpointParams } from './types/ApiTypes';

export interface KickScraperOptions {
  debug?: boolean;
  logger?: Logger;
}

export class KickScraper {
  private api: Api;
  private sessionManager: SessionManager;
  private logger: Logger;

  constructor(options: KickScraperOptions = {}) {
    this.logger = options.logger || initializeLogger({ enableLogging: options.debug });
    this.sessionManager = new SessionManager({ logger: this.logger });
    this.api = new Api(this.sessionManager, { logger: this.logger });
  }

  async getClips(params: EndpointParams<'clips'>, limit?: number): Promise<GetClipsResponse> {
    try {
      if (limit && limit > 0) {
        return await this.api.getClipsWithLimit(params, limit);
      }
      return await this.api.getClips(params);
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