#!/usr/bin/env node

import { scrapeKickPage, testClipApi } from './scraper';
import { initializeLogger } from './logger';

const runCLI = async () => {
  const args = process.argv.slice(2);

  // Show usage if no arguments
  if (args.length === 0) {
    console.log('\nUsage:');
    console.log('  node src/cli.ts [options]');
    console.log('\nOptions:');
    console.log('  --clips       Scrape the clips page (e.g. top daily clips)');
    console.log('  --test        Test grabbing Bearer token/cookies and calling the Kick API directly');
    console.log('\nExample:');
    console.log('  node src/cli.ts --clips');
    console.log('  node src/cli.ts --test\n');
    process.exit(0);
  }

  const logger = initializeLogger({ enableLogging: true });

  try {
    if (args.includes('--test')) {
      // Run the test function that fetches Bearer token/cookies and calls the API
      const apiData = await testClipApi(logger);
      console.log('\n=== Kick API Response ===');
      console.log(JSON.stringify(apiData, null, 2));
      process.exit(0);
    }

    // Otherwise, check if user wants to scrape the clips page
    const scrapeClips = args.includes('--clips');
    if (!scrapeClips) {
      console.log('\nInvalid or missing options.\n');
      console.log('Try `node src/cli.ts --clips` to scrape the clips page.');
      console.log('Or `node src/cli.ts --test` to test API call.\n');
      process.exit(0);
    }

    // If user used the `--clips` flag
    const data = await scrapeKickPage({ customLogger: logger, scrapeClips });
    console.log(JSON.stringify(data, null, 2));
  } catch (err: any) {
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  runCLI();
}
