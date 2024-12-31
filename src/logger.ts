import { createLogger, format, transports, Logger } from 'winston';
import path from 'path';

interface LoggerOptions {
  customLogger?: Logger;
  enableLogging?: boolean;
}

const LOG_FILE = path.join(__dirname, '..', 'kick_scraper.log');

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