
# kick-live-checker

A Node.js tool to check if a Kick channel is currently live streaming.

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
    - [As a Standalone Tool](#as-a-standalone-tool)
    - [As a Dependency](#as-a-dependency)
- [Example](#example)
- [Dependencies](#dependencies)
- [License](#license)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/kick-live-checker.git
   ```

2. Navigate to the project directory:
   ```bash
   cd kick-live-checker
   ```

3. Install the dependencies:
   ```bash
   npm install
   ```

## Usage

### As a Standalone Tool

To use `kick-live-checker` as a standalone CLI tool, run the following command with the Kick channel name as an argument:

```bash
node index.js <channelName>
```

Replace `<channelName>` with the name of the Kick channel you want to check.

Example:
```bash
node index.js xqc
```

### As a Dependency

To use `kick-live-checker` in your project, first install it via npm:

```bash
npm install kick-live-checker
```

Then, import and use it in your code:

```javascript
const { checkChannelLiveStatus } = require('kick-live-checker');

// Optional: Use your own logger
const winston = require('winston');
const customLogger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

checkChannelLiveStatus('xqc', { logger: customLogger })
    .then(result => {
        console.log(result);
    })
    .catch(error => {
        console.error(error);
    });
```

If you don't provide a custom logger, `kick-live-checker` will use its default logging configuration based on the `NODE_ENV` environment variable.

## Example Output

When a channel is live, you’ll see output similar to:

```json
{
  "isLive": true,
  "channelName": "xQc",
  "title": "🛑LIVE🛑LIVE🛑LIVE🛑LIVE🛑DRAMA🛑STUFF🛑AHHHHHHHHH🛑",
  "channelUrl": "https://kick.com/xqc"
}
```

When a channel is not live, the output will be:

```json
{
  "isLive": false,
  "channelUrl": "https://kick.com/xqc"
}
```

## Dependencies

This project relies on the following Node.js packages:
- `puppeteer` for web scraping and navigation
- `winston` for logging

## License

This project is licensed under the [Prosperity Public License](./LICENSE). You are free to use this software non-commercially. For commercial use, please contact the author for permission or refer to the terms in the license.
