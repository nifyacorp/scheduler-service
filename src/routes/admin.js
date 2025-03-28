import logger from '../utils/logger.js';

/**
 * Register admin-related routes
 * @param {FastifyInstance} server - The Fastify server instance
 */
export function registerAdminRoutes(server) {
  // Get service diagnostics
  server.get('/api/v1/admin/diagnostics', {
    schema: {
      summary: 'Get service diagnostics',
      description: 'Get detailed diagnostic information about the scheduler service',
      tags: ['Admin'],
      response: {
        200: {
          type: 'object',
          properties: {
            uptime: { type: 'number' },
            environment: { type: 'string' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  taskType: { type: 'string' },
                  description: { type: 'string' },
                  cronSchedule: { type: 'string', nullable: true },
                  nextExecution: { type: 'string', format: 'date-time', nullable: true },
                  lastExecution: {
                    type: 'object',
                    properties: {
                      executionId: { type: 'string' },
                      startTime: { type: 'string', format: 'date-time' },
                      success: { type: 'boolean' },
                      duration: { type: 'number' }
                    },
                    nullable: true
                  }
                }
              }
            },
            taskStats: {
              type: 'object',
              properties: {
                totalExecutions: { type: 'integer' },
                successfulExecutions: { type: 'integer' },
                failedExecutions: { type: 'integer' },
                avgDuration: { type: 'number' },
                maxDuration: { type: 'number' }
              }
            },
            memoryUsage: {
              type: 'object',
              properties: {
                rss: { type: 'string' },
                heapTotal: { type: 'string' },
                heapUsed: { type: 'string' },
                external: { type: 'string' },
                arrayBuffers: { type: 'string' }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        // Get all task definitions
        const taskDefinitions = server.scheduler.getTaskDefinitions();
        
        // Get all task history
        const { history } = await server.scheduler.getHistory(null, { limit: 1000 });
        
        // Calculate task statistics
        const taskStats = {
          totalExecutions: history.length,
          successfulExecutions: history.filter(entry => entry.success).length,
          failedExecutions: history.filter(entry => !entry.success).length,
          avgDuration: history.length > 0 
            ? history.reduce((sum, entry) => sum + entry.duration, 0) / history.length 
            : 0,
          maxDuration: history.length > 0 
            ? Math.max(...history.map(entry => entry.duration)) 
            : 0
        };
        
        // Get next execution time for each task with a cron schedule
        const tasks = await Promise.all(Object.entries(taskDefinitions).map(async ([taskType, definition]) => {
          // Find last execution for this task
          const lastExecution = history
            .filter(entry => entry.taskType === taskType)
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
          
          // Get next execution time if there's a cron schedule
          let nextExecution = null;
          if (definition.cronSchedule) {
            const cronParser = (await import('cron-parser')).default;
            try {
              const interval = cronParser.parseExpression(definition.cronSchedule);
              nextExecution = interval.next().toISOString();
            } catch (error) {
              logger.warn(`Failed to parse cron expression for task ${taskType}`, {
                taskType,
                cronSchedule: definition.cronSchedule,
                error: error.message
              });
            }
          }
          
          return {
            taskType,
            description: definition.description || '',
            cronSchedule: definition.cronSchedule || null,
            nextExecution,
            lastExecution: lastExecution ? {
              executionId: lastExecution.executionId,
              startTime: lastExecution.startTime,
              success: lastExecution.success,
              duration: lastExecution.duration
            } : null
          };
        }));
        
        // Get memory usage
        const memoryUsage = process.memoryUsage();
        
        return {
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
          tasks,
          taskStats,
          memoryUsage: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
            arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)} MB`
          }
        };
      } catch (error) {
        logger.error('Error getting service diagnostics', {
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to get service diagnostics: ${error.message}`
        });
      }
    }
  });
}