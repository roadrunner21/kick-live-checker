// logger.ts
import { createLogger, format, transports, Logger } from 'winston';
import path from 'path';
import { PATHS } from './constants';

interface LoggerOptions {
  customLogger?: Logger;
  enableLogging?: boolean;
}

// Generate a timestamp-based log filename
const getLogFileName = (): string => {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return `kick_scraper_${timestamp}.log`;
};

export function initializeLogger(options: LoggerOptions = {}): Logger {
  const { customLogger, enableLogging } = options;

  if (customLogger) {
    return customLogger;
  }

  // If logging is disabled, create a silent logger
  if (!enableLogging) {
    return createLogger({
      transports: [
        new transports.Console({
          silent: true
        })
      ]
    });
  }

  const LOG_FILE = path.join(PATHS.LOGS, getLogFileName());

  // If logging is enabled, create a verbose logger
  return createLogger({
    level: 'debug',
    format: format.combine(
      format.timestamp(),
      format.printf(({ timestamp, level, message }) =>
        `[${timestamp}] ${level.toUpperCase()}: ${message}`
      )
    ),
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      }),
      new transports.File({
        filename: LOG_FILE,
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })
    ]
  });
}