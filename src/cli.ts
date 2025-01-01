#!/usr/bin/env node

import { Api } from './Api';
import { SessionManager } from './SessionManager';
import { initializeLogger } from './logger';
import { GetClipsResponse } from "./types/ClipResponse";

const runCLI = async () => {
  const args = process.argv.slice(2);

  // Show usage if no arguments
  if (args.length === 0) {
    console.log('\nUsage:');
    console.log('  node src/cli.ts [options]');
    console.log('\nOptions:');
    console.log('  --clips       Get the clips (e.g. top daily clips)');
    console.log('  --debug       Enable debug logging');
    console.log('\nExample:');
    console.log('  node src/cli.ts --clips');
    console.log('  node src/cli.ts --clips --debug\n');
    process.exit(0);
  }

  const debug = args.includes('--debug');
  const logger = initializeLogger({enableLogging: debug});
  const sessionManager = new SessionManager({logger});
  const api = new Api(sessionManager, {logger});

  try {
    if (args.includes('--clips')) {
      const response: GetClipsResponse = await api.getClips({ sort: 'view', time: 'day' });

      console.log(response);
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