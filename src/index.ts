#!/usr/bin/env node

/**
 * The main entry point for the CLI and the package export.
 */
import { Api } from './Api';
import { SessionManager, SessionError, CloudflareError } from './SessionManager';
import { initializeLogger } from './logger';

/**
 * If this script is run directly from the CLI, handle command line usage
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const debug = args.includes('--debug');
  const scrapeClips = args.includes('--clips');

  if (!scrapeClips) {
    console.error('\nPlease provide a valid option:');
    console.error('  node index.js --clips     (to get clips)');
    console.error('  node index.js --clips --debug     (to get clips with debug output)\n');
    process.exit(1);
  }

  // Initialize components
  const logger = initializeLogger({ enableLogging: debug });
  const sessionManager = new SessionManager({ logger });
  const api = new Api(sessionManager, { logger });

  // Execute the requested operation
  api.getClips({ sort: 'view', range: 'day' })
    .then((response) => {
      if (!debug) {
        console.log(response);
      }
    })
    .catch((err) => {
      logger.error(`Failed to get clips: ${err.message}`);
      process.exit(1);
    })
    .finally(() => {
      sessionManager.dispose();
    });
}

/**
 * Export functionality for importing in other projects
 */
export { Api } from './Api';
export { SessionManager, SessionError, CloudflareError } from './SessionManager';
export { initializeLogger } from './logger';

// Also export interfaces that might be needed by consumers
export type { RequestResponse, CapturedRequestInfo } from './SessionManager';