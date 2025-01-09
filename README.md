# ts-kick-scraper

A Node.js library and CLI tool to scrape Kick.com clips in a structured JSON format.

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Usage](#usage)
    - [As a Library](#as-a-library)
    - [As a CLI Tool](#as-a-cli-tool)
- [API Reference](#api-reference)
- [Example Output](#example-output)
- [Dependencies](#dependencies)
- [License](#license)

## Installation

### As a library in your project:
```bash
npm install ts-kick-scraper
```

### As a global CLI tool:
```bash
npm install -g ts-kick-scraper
```

### For development:
```bash
git clone https://github.com/Hefti-Web-Solutions/ts-kick-scraper
cd ts-kick-scraper
npm install
npm run build
```

## Features

- Fetch clips from Kick.com with pagination support
- Configure clip limits (defaults to 20)
- Debug mode for detailed logging
- Support for sorting and time range filters
- Automatic Cloudflare challenge handling
- Temporary file storage for responses and logs

# ts-kick-scraper

A Node.js library and CLI tool to scrape Kick.com clips in a structured JSON format.

[Previous sections remain the same until Usage...]

## Usage

### As a Library

```typescript
import { KickScraper, ClipOptions } from 'ts-kick-scraper';

// Initialize with debug mode (optional)
const scraper = new KickScraper({ debug: true });

// Get clips with default parameters (sort: 'view', time: 'day', limit: 20)
const clips = await scraper.getClips();

// Get clips with custom parameters
const moreClips = await scraper.getClips({
  sort: 'trending',
  time: 'week'
}, 60); // will fetch 60 clips

// Access available options
console.log('Available sort options:', ClipOptions.sort);
console.log('Available time periods:', ClipOptions.time);
```

### As a CLI Tool

Basic usage:
```bash
# Get default number of clips (20)
kick-scraper --clips

# Get specific number of clips with sorting and time range
kick-scraper --clips --limit 40 --sort trending --time week

# Enable debug logging
kick-scraper --clips --debug
```

Show help:
```bash
kick-scraper
```

## API Reference

### KickScraper Class

#### Constructor Options
```typescript
interface KickScraperOptions {
  debug?: boolean;    // Enable debug logging
  logger?: Logger;    // Custom Winston logger instance
}
```

#### Methods

`getClips(params?, limit?)`
- `params`: Optional clip parameters (sort and time range)
- `limit`: Optional number of clips to fetch (default: 20)
- Returns: Promise<GetClipsResponse>

### Parameters

```typescript
// Available through ClipOptions export
const ClipOptions = {
  sort: ['view', 'recent', 'trending'],
  time: ['day', 'week', 'month', 'all']
} as const;

// Type-safe parameter interface
interface ClipParams {
  sort?: 'view' | 'recent' | 'trending';  // defaults to 'view'
  time?: 'day' | 'week' | 'month' | 'all';  // defaults to 'day'
}
```

## Example Output

```json
{
  "clips": [
    {
      "id": "clip_123",
      "title": "Amazing play!",
      "clip_url": "https://kick.com/clip/123",
      "thumbnail_url": "https://...",
      "views": 1500,
      "duration": 30,
      "created_at": "2025-01-02T15:30:45Z",
      "channel": {
        "username": "streamer123",
        "profile_picture": "https://..."
      }
    }
    // ... more clips
  ],
  "nextCursor": "clip_124"
}
```

## Dependencies

- `puppeteer-extra`: Web scraping and browser automation
- `puppeteer-extra-plugin-stealth`: Bypass detection
- `winston`: Logging system
- `typescript`: Type safety and development

## License

This project is licensed under the [MIT License](./LICENSE).

## Development

### Project Structure
```
.
├── src/
│   ├── types/
│   │   ├── ApiTypes.ts     # API type definitions
│   │   └── ClipResponse.ts # Clip response interfaces
│   ├── Api.ts             # Core API implementation
│   ├── SessionManager.ts  # Browser session handling
│   ├── apiEndpoints.ts    # API endpoint configurations
│   ├── cli.ts            # CLI implementation
│   ├── constants.ts      # Configuration constants
│   ├── index.ts         # Main library exports
│   ├── logger.ts        # Logging setup
│   ├── scraper.ts       # Main scraper logic
│   └── urlBuilder.ts    # URL construction utilities
├── tmp/                # Temporary files (git-ignored)
│   ├── last_response.html
│   └── *.json         # Clip response files
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── README.md
```

### Key Files
- `src/index.ts`: Main entry point and exports for the library
- `src/cli.ts`: Command-line interface implementation
- `src/Api.ts`: Core API implementation for interacting with Kick.com
- `src/SessionManager.ts`: Manages browser sessions and handles Cloudflare
- `src/types/`: TypeScript interfaces and type definitions
- `tmp/`: Temporary storage for responses and logs (git-ignored)

### Building

```bash
npm run build
```

### Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.