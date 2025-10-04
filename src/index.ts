import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { swaggerUI } from '@hono/swagger-ui';
import { createOpenAPIApp, openAPIConfig } from './lib/openapi.js';
import { registerVideoRoutes } from './routes/video.js';
import { logger } from './lib/logger.js';

const app = createOpenAPIApp();
const isDevelopment = process.env.NODE_ENV !== 'production';

// Register API routes
const videoRoutes = registerVideoRoutes();
app.route('/', videoRoutes);

// Health check endpoint (always available)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint with API information (always available)
app.get('/', (c) => {
  return c.json({
    name: 'Changelog to Video API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      generateVideo: 'POST /v1/api/generate-video',
      getJobStatus: 'GET /v1/api/jobs/{jobId}',
      downloadVideo: 'GET /v1/api/videos/{jobId}',
      ...(isDevelopment && {
        playground: '/playground',
        docs: '/api/docs',
        openapi: '/api/openapi.json',
      }),
    },
  });
});

// Development-only endpoints
if (isDevelopment) {
  // Playground
  app.use('/playground', serveStatic({ path: './public/playground.html' }));

  // OpenAPI documentation
  app.doc('/api/openapi.json', openAPIConfig);

  // Swagger UI
  app.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));
}

const port = parseInt(process.env.PORT || '3000', 10);

logger.info(`Starting server on port ${port}...`);
logger.info(`Environment: ${isDevelopment ? 'development' : 'production'}`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info(`✨ Server running at http://localhost:${info.port}`);

    if (isDevelopment) {
      logger.info(`🎮 Playground: http://localhost:${info.port}/playground`);
      logger.info(`📚 API Docs: http://localhost:${info.port}/api/docs`);
      logger.info(`📄 OpenAPI: http://localhost:${info.port}/api/openapi.json`);
    }
  }
);
