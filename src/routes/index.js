import { registerTaskRoutes } from './tasks.js';
import { registerHistoryRoutes } from './history.js';
import { registerAdminRoutes } from './admin.js';
import { registerTemplateRoutes } from './templates.js';
import { authMiddleware } from '../utils/auth.js';

/**
 * Register all API routes
 * @param {FastifyInstance} server - The Fastify server instance
 */
export function registerRoutes(server) {
  // Secure all routes except health and ready checks
  server.addHook('onRequest', async (request, reply) => {
    // Skip auth for health, ready, and docs
    const publicPaths = ['/health', '/ready', '/documentation', '/swagger', '/swagger.json'];
    
    if (publicPaths.some(path => request.url.startsWith(path))) {
      return;
    }
    
    // Apply auth middleware
    await authMiddleware(request, reply);
  });
  
  // Register task routes
  registerTaskRoutes(server);
  
  // Register history routes
  registerHistoryRoutes(server);
  
  // Register template routes
  registerTemplateRoutes(server);
  
  // Register admin routes
  registerAdminRoutes(server);
}