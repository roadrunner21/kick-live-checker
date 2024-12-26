import { createLogger, format, transports, Logger } from 'winston';
import path from 'path';

interface LoggerOptions {
  customLogger?: Logger;
  enableLogging?: boolean;
}

const LOG_FILE = path.join(__dirname, '..', 'kick_scraper.log');

/**
 * Initialize a Winston Logger
 * @param options - Logger configuration options
 * @returns A configured logger instance
 */
export function initializeLogger(options: LoggerOptions = {}): Logger {
  const { customLogger, enableLogging } = options;

  if (customLogger) {
    // Use the provided custom logger instead
    return customLogger;
  }

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const loggerTransports = [];

  // In development or if logging is explicitly enabled, log to console
  if (isDevelopment || enableLogging) {
    loggerTransports.push(new transports.Console());

    // In development, optionally log to file as well
    if (isDevelopment) {
      loggerTransports.push(new transports.File({ filename: LOG_FILE }));
    }
  }

  // If in production and not enabling logging, create a "silent" console
  if (!isDevelopment && !enableLogging) {
    loggerTransports.push(new transports.Console({ silent: true }));
  } else if (!isDevelopment && enableLogging) {
    // In production with logging enabled, only log warnings and above
    loggerTransports.push(new transports.Console({
      level: 'warn',
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
      ),
    }));
  }

  return createLogger({
    level: (isDevelopment || enableLogging) ? 'debug' : 'info',
    format: format.combine(
      format.timestamp(),
      format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
    ),
    transports: loggerTransports,
  });
}
