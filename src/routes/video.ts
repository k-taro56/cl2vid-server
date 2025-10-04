import { createRoute } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi.js';
import {
  GenerateVideoRequestSchema,
  JobIdParamSchema,
  JobResponseSchema,
  ErrorResponseSchema,
  type JobResponse,
} from '../schemas/video.js';
import { fetchChangelog, extractLatestRelease } from '../services/changelog.js';
import {
  analyzeChangelog,
  generateImagePrompt,
  generateVideo,
} from '../services/gemini.js';
import { generateImage, pollHiggsfieldJob } from '../services/higgsfield.js';
import { logger } from '../lib/logger.js';

// In-memory job storage (in production, use a database)
const jobs = new Map<string, JobResponse>();

// Allowed domains for video URLs (security: prevent API key leakage to malicious domains)
const ALLOWED_VIDEO_DOMAINS = [
  'generativelanguage.googleapis.com',
  'storage.googleapis.com',
];

/**
 * Validates if the video URL is from an allowed domain
 */
function isAllowedDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_VIDEO_DOMAINS.some(domain =>
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Video proxy route
const getVideoRoute = createRoute({
  method: 'get',
  path: '/v1/api/videos/{jobId}',
  summary: 'Download video',
  description: 'Proxy endpoint to download video without exposing API key',
  tags: ['Videos'],
  request: {
    params: JobIdParamSchema,
  },
  responses: {
    200: {
      description: 'Video file',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Video not found',
    },
  },
});

// Generate video route
const generateVideoRoute = createRoute({
  method: 'post',
  path: '/v1/api/generate-video',
  summary: 'Generate video from GitHub Changelog',
  description: 'Initiates video generation from a GitHub Changelog URL',
  tags: ['Video Generation'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: GenerateVideoRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: JobResponseSchema,
        },
      },
      description: 'Job created successfully',
    },
    422: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

// Get job status route
const getJobStatusRoute = createRoute({
  method: 'get',
  path: '/v1/api/jobs/{jobId}',
  summary: 'Get job status',
  description: 'Retrieves the status of a video generation job',
  tags: ['Jobs'],
  request: {
    params: JobIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: JobResponseSchema,
        },
      },
      description: 'Job found',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Job not found',
    },
  },
});

export function registerVideoRoutes() {
  const app = createOpenAPIApp();

  // POST /api/generate-video
  app.openapi(generateVideoRoute, async (c) => {
    try {
      const { changelogUrl, aspectRatio, resolution } = c.req.valid('json');

      // Create job
      const jobId = crypto.randomUUID();
      const job: JobResponse = {
        id: jobId,
        status: 'queued',
        createdAt: new Date().toISOString(),
        changelogUrl,
      };

      jobs.set(jobId, job);

      // Process in background
      processVideoGeneration(jobId, changelogUrl, aspectRatio, resolution).catch((error) => {
        const failedJob = jobs.get(jobId);
        if (failedJob) {
          failedJob.status = 'failed';
          failedJob.error = error instanceof Error ? error.message : 'Unknown error';
          jobs.set(jobId, failedJob);
        }
      });

      return c.json(job, 200);
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to create job',
        },
        500
      );
    }
  });

  // GET /api/jobs/{jobId}
  app.openapi(getJobStatusRoute, async (c) => {
    const { jobId } = c.req.valid('param');
    const job = jobs.get(jobId);

    if (!job) {
      return c.json(
        {
          ok: false,
          error: 'Job not found',
        },
        404
      );
    }

    // Replace Gemini URL with proxy URL for security
    const responseJob = { ...job };
    if (job.status === 'completed' && job.videoUrl) {
      responseJob.videoUrl = `/v1/api/videos/${jobId}`;
    }

    return c.json(responseJob, 200);
  });

  // GET /v1/api/videos/{jobId} - Proxy video download
  app.get('/v1/api/videos/:jobId', async (c) => {
    const jobId = c.req.param('jobId');
    const job = jobs.get(jobId);

    if (!job || !job.videoUrl) {
      return c.json(
        {
          ok: false,
          error: 'Video not found',
        },
        404
      );
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
      }

      // Security: Validate domain to prevent API key leakage
      const videoUrl = job.videoUrl;
      if (!isAllowedDomain(videoUrl)) {
        logger.error(`[SECURITY] Blocked request to untrusted domain: ${videoUrl}`);
        return c.json(
          {
            ok: false,
            error: 'Invalid video URL domain',
          },
          403
        );
      }

      // Parse the video URL and add API key
      const urlWithKey = videoUrl.includes('?')
        ? `${videoUrl}&key=${apiKey}`
        : `${videoUrl}?key=${apiKey}`;

      // Fetch video from Gemini with API key
      const response = await fetch(urlWithKey);

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      // Stream video to client
      const videoBuffer = await response.arrayBuffer();

      return c.body(videoBuffer, 200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="video-${jobId}.mp4"`,
      });
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to fetch video',
        },
        500
      );
    }
  });

  return app;
}

/**
 * Background process for video generation
 */
async function processVideoGeneration(
  jobId: string,
  changelogUrl: string,
  aspectRatio: '16:9' | '9:16',
  resolution: '720p' | '1080p'
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Update status to processing
    job.status = 'processing';
    jobs.set(jobId, job);

    // Step 1: Fetch and extract changelog
    logger.info(`[${jobId}] Fetching changelog...`);
    const changelog = await fetchChangelog(changelogUrl);
    const latestRelease = extractLatestRelease(changelog);

    // Step 2: Analyze changelog and create script
    logger.info(`[${jobId}] Analyzing changelog...`);
    const script = await analyzeChangelog(latestRelease);

    // Step 3: Generate image prompt
    logger.info(`[${jobId}] Generating image prompt...`);
    const imagePrompt = await generateImagePrompt(script);

    // Step 4: Generate image with Higgsfield
    logger.info(`[${jobId}] Generating image...`);
    const higgsfieldJobId = await generateImage(imagePrompt);
    const imageUrl = await pollHiggsfieldJob(higgsfieldJobId);

    // Step 5: Generate video with Veo (includes polling)
    logger.info(`[${jobId}] Generating video...`);
    const videoUrlWithKey = await generateVideo(imageUrl, script, aspectRatio, resolution);

    // Remove API key from URL before storing
    const videoUrlWithoutKey = videoUrlWithKey.replace(/[?&]key=[^&]+/, '');

    // Update job as completed with Gemini URL (will be converted to proxy URL in response)
    job.status = 'completed';
    job.videoUrl = videoUrlWithoutKey;
    jobs.set(jobId, job);

    logger.info(`[${jobId}] Video generation completed`);
  } catch (error) {
    logger.error(`[${jobId}] Error:`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    jobs.set(jobId, job);
  }
}
