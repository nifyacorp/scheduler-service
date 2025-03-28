import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { config } from './config/index.js';
import logger from './utils/logger.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './utils/error-handler.js';

/**
 * Creates and configures the Fastify server
 * @param {Object} scheduler - The initialized scheduler instance
 * @returns {FastifyInstance} The configured server instance
 */
export async function createServer(scheduler) {
  // Create Fastify instance with logging
  const server = Fastify({
    logger: false, // Use our custom logger instead
    trustProxy: true
  });

  // Register error handler
  server.setErrorHandler(errorHandler);

  // Register plugins
  await server.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  });

  // Register Swagger documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'NIFYA Scheduler Service API',
        description: 'API for managing scheduled tasks in the NIFYA platform',
        version: '1.0.0'
      },
      servers: [
        {
          url: config.publicUrl,
          description: 'Production server'
        },
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server'
        }
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
          }
        }
      }
    }
  });

  // Register Swagger UI
  await server.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    }
  });

  // Add scheduler to server instance so routes can access it
  server.decorate('scheduler', scheduler);

  // Register all routes
  registerRoutes(server);

  // Add health check route
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Add ready check route
  server.get('/ready', async (request, reply) => {
    const isReady = scheduler.isReady();
    if (isReady) {
      return { status: 'ready', timestamp: new Date().toISOString() };
    }
    reply.code(503);
    return { status: 'not_ready', message: 'Scheduler not fully initialized' };
  });

  server.addHook('onRequest', (request, reply, done) => {
    logger.debug(`${request.method} ${request.url}`, {
      method: request.method,
      url: request.url,
      ip: request.ip,
      id: request.id
    });
    done();
  });

  server.addHook('onResponse', (request, reply, done) => {
    logger.debug(`${reply.statusCode} ${request.method} ${request.url}`, {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
      id: request.id
    });
    done();
  });

  return server;
}