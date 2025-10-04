# Changelog to Video API

A Hono-based backend server that generates video content from GitHub Changelogs using Gemini Veo and Higgsfield APIs.

## Features

- 📄 Fetch and parse latest release information from GitHub Changelog URLs
- 🤖 Analyze and summarize changelogs using Gemini 2.5 Flash
- 🎨 Generate images with Higgsfield Soul API
- 🎬 Create videos from images using Gemini Veo 3 Fast (image-to-video)
- 📚 Automatic OpenAPI documentation generation
- ✅ Type-safe schema validation with Zod
- 🔒 Secure API key handling with domain whitelisting
- 🌐 API versioning with `/v1` prefix
- 🎮 Interactive Playground UI (development only)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure your API keys:

```bash
cp .env.example .env
```

Required API keys:
- **GEMINI_API_KEY**: Get from [Google AI Studio](https://aistudio.google.com/apikey)
- **HIGGSFIELD_API_KEY**: Get from [Higgsfield Platform](https://platform.higgsfield.ai)
- **HIGGSFIELD_SECRET**: Get from Higgsfield Platform

Environment options:
- **NODE_ENV**: `development` (default) or `production`
- **DEBUG**: `false` (default) or `true` for debug logs
- **PORT**: Server port (default: `3000`)

### 3. Run Development Server

```bash
pnpm dev
```

Server starts at `http://localhost:3000`

**Development endpoints:**
- 🎮 Playground: `http://localhost:3000/playground`
- 📚 API Docs (Swagger): `http://localhost:3000/api/docs`
- 📄 OpenAPI Schema: `http://localhost:3000/api/openapi.json`

## API Endpoints

### Core API (v1)

#### POST /v1/api/generate-video

Initiate video generation from a GitHub Changelog URL.

**Request Body:**

```json
{
  "changelogUrl": "https://github.com/anthropics/anthropic-sdk-typescript/blob/main/CHANGELOG.md",
  "aspectRatio": "16:9",
  "resolution": "1080p"
}
```

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "createdAt": "2025-10-04T12:00:00Z",
  "changelogUrl": "https://github.com/..."
}
```

#### GET /v1/api/jobs/{jobId}

Check job status.

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "createdAt": "2025-10-04T12:00:00Z",
  "changelogUrl": "https://github.com/...",
  "videoUrl": "/v1/api/videos/{jobId}"
}
```

**Status values:**
- `queued`: Job created, waiting to be processed
- `processing`: Currently processing
- `completed`: Successfully completed
- `failed`: Failed with error

#### GET /v1/api/videos/{jobId}

Download the generated video (proxied for security).

**Response:** Video file (MP4)

### Utility Endpoints

#### GET /health

Health check endpoint (always available).

#### GET /

API information and available endpoints.

## Production Deployment

### Build

```bash
pnpm build
```

### Start Production Server

```bash
pnpm start
```

**Production configuration:**
- Set `NODE_ENV=production` to disable development endpoints
- Set `DEBUG=false` to disable debug logging
- Playground, Swagger UI, and OpenAPI docs are automatically disabled

## Architecture

### Video Generation Pipeline

1. **Fetch Changelog**: Retrieve latest release from GitHub URL
2. **Text Analysis**: Summarize changelog using Gemini 2.5 Flash
3. **Image Prompt**: Generate image description with Gemini
4. **Image Generation**: Create visual with Higgsfield Soul API
5. **Video Generation**: Convert image to video using Veo 3 Fast (image-to-video)
6. **Async Polling**: Wait for completion and return video URL

### Technology Stack

- **[Hono](https://hono.dev/)**: Fast, lightweight web framework
- **[Zod](https://zod.dev/)**: TypeScript-first schema validation
- **[@hono/zod-openapi](https://github.com/honojs/middleware)**: Automatic OpenAPI generation
- **[@google/genai](https://www.npmjs.com/package/@google/genai)**: Gemini API SDK for video generation
- **[@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)**: Gemini API SDK for text generation
- **Gemini 2.5 Flash**: Text analysis and summarization
- **Gemini Veo 3 Fast**: AI video generation with audio
- **Higgsfield Soul API**: Photorealistic image generation

### Security Features

- 🔐 **API Key Protection**: Never exposed to clients
- 🛡️ **Domain Whitelisting**: Only trusted Google domains allowed
- 🔒 **Video Proxy**: Secure download without exposing credentials
- 🌐 **API Versioning**: `/v1` prefix for future-proof changes
- 🚫 **Production Hardening**: Dev endpoints disabled in production

## Configuration

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Debug (set to 'true' for detailed logs)
DEBUG=false

# API Keys
GEMINI_API_KEY=your_gemini_api_key
HIGGSFIELD_API_KEY=your_higgsfield_api_key_uuid
HIGGSFIELD_SECRET=your_higgsfield_secret
```

### Logging

The server uses an opt-in debug logging system:

- **Production** (`DEBUG=false`): Only info, warn, and error logs
- **Development** (`DEBUG=true`): Includes detailed debug logs

## Important Notes

- ⏱️ Video generation takes 11 seconds to 6 minutes
- 🗑️ Veo-generated videos are deleted after 2 days
- 🔄 Currently uses in-memory storage (use a database for production)
- 🔖 Videos include SynthID watermark

## Development

### Type Checking

```bash
pnpm type-check
```

### Project Structure

```
cl2vid-server/
├── src/
│   ├── index.ts              # Main application entry
│   ├── lib/
│   │   ├── logger.ts         # Logging utility
│   │   └── openapi.ts        # OpenAPI configuration
│   ├── routes/
│   │   └── video.ts          # Video generation routes
│   ├── schemas/
│   │   └── video.ts          # Zod schemas
│   └── services/
│       ├── changelog.ts      # Changelog fetching
│       ├── gemini.ts         # Gemini API client
│       └── higgsfield.ts     # Higgsfield API client
├── public/
│   └── playground.html       # Interactive UI
└── package.json
```

## License

MIT
