import { z } from '@hono/zod-openapi';

// Request schemas
export const GenerateVideoRequestSchema = z.object({
  changelogUrl: z.string().url().openapi({
    example: 'https://github.com/anthropics/anthropic-sdk-typescript/blob/main/CHANGELOG.md',
    description: 'GitHub Changelog URL',
  }),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9').openapi({
    example: '16:9',
    description: 'Video aspect ratio',
  }),
  resolution: z.enum(['720p', '1080p']).default('1080p').openapi({
    example: '1080p',
    description: 'Video resolution',
  }),
});

export const JobIdParamSchema = z.object({
  jobId: z.string().uuid().openapi({
    param: {
      name: 'jobId',
      in: 'path',
    },
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
});

// Response schemas
export const JobResponseSchema = z.object({
  id: z.string().uuid().openapi({
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
  status: z.enum(['queued', 'processing', 'completed', 'failed']).openapi({
    example: 'processing',
  }),
  createdAt: z.string().datetime().openapi({
    example: '2025-10-04T12:00:00Z',
  }),
  changelogUrl: z.string().url().openapi({
    example: 'https://github.com/anthropics/anthropic-sdk-typescript/blob/main/CHANGELOG.md',
  }),
  videoUrl: z.string().url().optional().openapi({
    example: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
  }),
  error: z.string().optional().openapi({
    example: 'Failed to generate video',
  }),
});

export const ErrorResponseSchema = z.object({
  ok: z.boolean().openapi({ example: false }),
  error: z.string().openapi({ example: 'Invalid request' }),
  details: z.any().optional(),
});

export type GenerateVideoRequest = z.infer<typeof GenerateVideoRequestSchema>;
export type JobIdParam = z.infer<typeof JobIdParamSchema>;
export type JobResponse = z.infer<typeof JobResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
