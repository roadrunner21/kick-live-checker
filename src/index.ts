#!/usr/bin/env node

/**
 * The main entry point for the CLI and the package export.
 */
import { scrapeKickPage } from './scraper';
import { initializeLogger } from './logger';

/**
 * If this script is run directly from the CLI (e.g., `node index.js <option>`),
 * we parse the arguments and run a scraping test.
 */
if (require.main === module) {
  const scrapeClips = process.argv.includes('--clips');

  if (!scrapeClips) {
    console.error('Please provide a valid option:');
    console.error('  node index.js --clips (to scrape clips)');
    process.exit(1);
  }

  // Initialize a logger for CLI usage
  const logger = initializeLogger({ enableLogging: true });

  scrapeKickPage({ customLogger: logger, scrapeClips })
    .then((data) => {
      logger.info('Scraped data successfully:');
      console.log(JSON.stringify(data, null, 2));
    })
    .catch((err) => {
      logger.error(`Failed to scrape: ${err.message}`);
      process.exit(1);
    });
}

/**
 * Export scraper functionality for importing in other projects.
 */
export { scrapeKickPage, testClipApi } from './scraper';
export { initializeLogger } from './logger';
