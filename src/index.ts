#!/usr/bin/env node

/**
 * The main entry point for the CLI and the package export.
 */
import { scrapeChannelPage } from './scraper';
import { initializeLogger } from './logger';

/**
 * If this script is run directly from the CLI (e.g., `node index.js <channelName>`),
 * we parse the arguments and run a scraping test.
 */
if (require.main === module) {
    const channelName = process.argv[2];
    if (!channelName) {
        console.error('Please provide a Kick channel name, e.g.:');
        console.error('  node index.js xqc');
        process.exit(1);
    }

    // Initialize a logger for CLI usage
    const logger = initializeLogger({ enableLogging: true });

    scrapeChannelPage(channelName, { customLogger: logger })
      .then((data) => {
          logger.info(`Scraped data for channel: ${data.channelName}`);
          logger.info(JSON.stringify(data, null, 2));
      })
      .catch((err) => {
          logger.error(`Failed to scrape channel: ${err.message}`);
          process.exit(1);
      });
}

/**
 * Export scraper functionality for importing in other projects.
 */
export { scrapeChannelPage } from './scraper';
export { initializeLogger } from './logger';

