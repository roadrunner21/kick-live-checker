#!/usr/bin/env node

import { scrapeKickPage } from './scraper';
import { initializeLogger } from './logger';

const runCLI = async () => {
  const args = process.argv.slice(2); // Get CLI arguments

  // Show usage if no arguments
  if (args.length === 0) {
    console.log('\nUsage:');
    console.log('  node src/cli.ts [options]');
    console.log('\nOptions:');
    console.log('  --clips        Scrape the clips page (e.g. top daily clips)');
    console.log('\nExample:');
    console.log('  node src/cli.ts --clips\n');
    process.exit(0);
  }

  // Check if user wants to scrape the clips page
  const scrapeClips = args.includes('--clips');

  // Add any additional flags you want to support here

  const logger = initializeLogger({ enableLogging: true });

  try {
    // If user only typed something else or did not use `--clips`,
    // we can either show usage or do something else:
    if (!scrapeClips) {
      console.log('\nInvalid or missing options.\n');
      console.log('Try `node src/cli.ts --clips` to scrape the clips page.\n');
      process.exit(0);
    }

    // If user used the `--clips` flag
    const data = await scrapeKickPage({ customLogger: logger, scrapeClips });
    console.log(JSON.stringify(data, null, 2)); // Print the result
  } catch (err: any) {
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  runCLI();
}
