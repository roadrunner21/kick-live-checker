#!/usr/bin/env node

import { Api } from './Api';
import { SessionManager } from './SessionManager';
import { initializeLogger } from './logger';
import { GetClipsResponse } from "./types/ClipResponse";
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const runCLI = async () => {
  const args = process.argv.slice(2);

  // Show usage if no arguments
  if (args.length === 0) {
    console.log('\nUsage:');
    console.log('  node src/cli.ts [options]');
    console.log('\nOptions:');
    console.log('  --clips              Get the clips (e.g. top daily clips)');
    console.log('  --limit <number>     Number of clips to fetch (default: 20)');
    console.log('  --debug              Enable debug logging');
    console.log('\nExample:');
    console.log('  node src/cli.ts --clips');
    console.log('  node src/cli.ts --clips --limit 40');
    console.log('  node src/cli.ts --clips --debug\n');
    process.exit(0);
  }

  const debug = args.includes('--debug');
  const logger = initializeLogger({enableLogging: debug});
  const sessionManager = new SessionManager({logger});
  const api = new Api(sessionManager, {logger});

  try {
    if (args.includes('--clips')) {
      // Parse limit flag
      const limitIndex = args.indexOf('--limit');
      const limit = limitIndex !== -1
        ? parseInt(args[limitIndex + 1], 10)
        : 20;

      // Validate limit
      if (isNaN(limit) || limit < 1) {
        console.error('Invalid limit value. Please provide a positive number.');
        process.exit(1);
      }

      const response: GetClipsResponse = await api.getClipsWithLimit(
        { sort: 'view', time: 'day' },
        limit
      );

      console.log(`Retrieved ${response.clips.length} clips`);

      // Create output directory if it doesn't exist
      const outputDir = join(__dirname, '..', 'tmp');
      mkdirSync(outputDir, { recursive: true });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `clips_${limit}_${timestamp}.json`;
      const outputPath = join(outputDir, filename);

      // Save full response to file
      writeFileSync(
        outputPath,
        JSON.stringify(response, null, 2)
      );

      console.log(`\nFull response saved to: ${outputPath}`);

      process.exit(0);
    }

    console.log('\nInvalid or missing options.\n');
    console.log('Try `node src/cli.ts --clips` to get clips.\n');
    process.exit(1);

  } catch (err: any) {
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    await sessionManager.dispose();
  }
};

if (require.main === module) {
  runCLI();
}
