import { OpenAPIHono } from '@hono/zod-openapi';

export function createOpenAPIApp() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            ok: false,
            error: 'Validation failed',
            details: result.error.flatten(),
          },
          422
        );
      }
    },
  });
}

export const openAPIConfig = {
  openapi: '3.1.0',
  info: {
    title: 'Changelog to Video API',
    version: '1.0.0',
    description: 'Generate release videos from GitHub Changelog using Gemini Veo and Higgsfield',
  },
  servers: [
    {
      url: 'http://localhost:3000/v1',
      description: 'Development server (v1)',
    },
  ],
};
