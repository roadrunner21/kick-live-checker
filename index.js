const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

// Constants and Configuration
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const LOG_FILE = path.join(__dirname, 'channel_live_check.log');
const LAST_RESPONSE_FILE = path.join(__dirname, 'last_response.html');
const ERROR_RESPONSE_FILE = path.join(__dirname, 'error_response.html');

/**
 * Initialize Logger
 * @param {Object} [options] - Options for initializing the logger.
 * @param {Object} [options.customLogger] - Optional custom logger provided by the host application.
 * @param {boolean} [options.enableLogging] - Enable logging when used as a dependency.
 * @returns {Object} - Configured logger instance.
 */
function initializeLogger(options = {}) {
    const { customLogger, enableLogging } = options;

    if (customLogger) {
        return customLogger;
    }

    const isDevelopment = process.env.NODE_ENV !== 'production';

    const loggerTransports = [];

    if (isDevelopment || enableLogging) {
        loggerTransports.push(new transports.Console());

        if (isDevelopment) {
            loggerTransports.push(new transports.File({ filename: LOG_FILE }));
        }
    }

    if (!isDevelopment && !enableLogging) {
        // Silent logger
        loggerTransports.push(new transports.Console({
            silent: true,
        }));
    } else if (!isDevelopment && enableLogging) {
        loggerTransports.push(new transports.Console({
            level: 'warn',
            format: format.combine(
                format.timestamp(),
                format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`),
            ),
        }));
    }

    return createLogger({
        level: isDevelopment || enableLogging ? 'debug' : 'info',
        format: format.combine(
            format.timestamp(),
            format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`),
        ),
        transports: loggerTransports,
    });
}

// Initialize logger with optional custom logger
const logger = initializeLogger();

/**
 * Check if a Kick channel is live
 * @param {string} channelName - The Kick channel name.
 * @param {Object} [options] - Options for the function.
 * @param {Object} [options.customLogger] - Optional custom logger provided by the host application.
 * @param {boolean} [options.enableLogging] - Enable logging when used as a dependency.
 * @returns {Promise<Object>} - Object containing live status and channel info.
 */
async function checkChannelLiveStatus(channelName, options = {}) {
    const pkgLogger = initializeLogger(options);
    const url = `https://kick.com/${channelName}`;
    pkgLogger.info(`Checking live status for Kick channel: ${channelName} at ${url}`);

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        // Set User-Agent and other headers to mimic a real browser
        await page.setUserAgent(USER_AGENT);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US',
        });

        // Listen for console events and log them
        page.on('console', (msg) => {
            for (let i = 0; i < msg.args().length; ++i) {
                pkgLogger.info(`PAGE LOG: ${msg.args()[i]}`);
            }
        });

        // Navigate to the page
        await page.goto(url, {
            waitUntil: 'networkidle2',
        });

        // Get page content and save to file for debugging
        const content = await page.content();
        fs.writeFileSync(LAST_RESPONSE_FILE, content, 'utf8');
        pkgLogger.info(`Page saved to ${LAST_RESPONSE_FILE}`);

        // Evaluate the page to determine if the channel is live
        const result = await page.evaluate(() => {
            const avatarElement = document.getElementById('channel-avatar');
            if (!avatarElement) {
                return { isLive: false, message: 'Channel avatar not found' };
            }

            const avatarWrapperDiv = avatarElement.parentElement;
            if (!avatarWrapperDiv) {
                return { isLive: false, message: 'Avatar wrapper div not found' };
            }

            const classList = avatarWrapperDiv.classList;

            if (classList.contains('border-green-500')) {
                const channelName = document.querySelector('#channel-username')?.textContent.trim() || 'Unknown Channel';
                const titleElement = document.querySelector('div.flex.min-w-0.max-w-full.shrink.gap-1.overflow-hidden span');
                const title = titleElement?.textContent.trim() || '';
                return { isLive: true, channelName, title };
            }

            return { isLive: false };
        });

        await browser.close();

        // Add channelUrl to the result
        result.channelUrl = url;

        if (result.isLive) {
            pkgLogger.info(`Channel ${result.channelName} is live!`);
            pkgLogger.info(`Title: ${result.title}`);
        } else {
            pkgLogger.info(`Channel ${channelName} is not live. Reason: ${result.message || 'Unknown'}`);
        }

        return result;
    } catch (error) {
        pkgLogger.error(`Error checking live status: ${error.message}`);
        fs.writeFileSync(ERROR_RESPONSE_FILE, error.message, 'utf8');
        throw error;
    }
}

// If run as a standalone script, take the channel name from CLI
if (require.main === module) {
    const channelName = process.argv[2];
    if (!channelName) {
        // eslint-disable-next-line no-console
        console.error('Please provide a Kick channel name.');
        process.exit(1);
    }

    checkChannelLiveStatus(channelName)
        .then((result) => {
            logger.info(result.isLive ? 'The channel is live!' : 'The channel is not live currently.');
            logger.info(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            logger.error(`Failed to check live status: ${error.message}`);
        });
}

// Export the function for external use
exports.checkChannelLiveStatus = checkChannelLiveStatus;
