import logger from '../utils/logger.js';

/**
 * Register history-related routes
 * @param {FastifyInstance} server - The Fastify server instance
 */
export function registerHistoryRoutes(server) {
  // Get task execution history
  server.get('/api/v1/history', {
    schema: {
      summary: 'Get task history',
      description: 'Get execution history for all tasks or a specific task type',
      tags: ['History'],
      querystring: {
        type: 'object',
        properties: {
          taskType: { type: 'string' },
          limit: { type: 'integer', default: 10 },
          offset: { type: 'integer', default: 0 },
          sortBy: { type: 'string', enum: ['startTime', 'endTime', 'duration'], default: 'startTime' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  executionId: { type: 'string' },
                  taskType: { type: 'string' },
                  parameters: { 
                    type: 'object',
                    additionalProperties: true
                  },
                  startTime: { type: 'string', format: 'date-time' },
                  endTime: { type: 'string', format: 'date-time' },
                  duration: { type: 'number' },
                  success: { type: 'boolean' },
                  result: { 
                    type: 'object',
                    additionalProperties: true,
                    nullable: true 
                  },
                  error: { 
                    type: 'string',
                    nullable: true 
                  }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                hasMore: { type: 'boolean' }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { taskType, limit = 10, offset = 0, sortBy = 'startTime', sortOrder = 'desc' } = request.query;
      
      try {
        const historyResult = await server.scheduler.getHistory(taskType, {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          sortBy,
          sortOrder
        });
        
        return historyResult;
      } catch (error) {
        logger.error('Error fetching task history', {
          taskType,
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to fetch task history: ${error.message}`
        });
      }
    }
  });
  
  // Get execution details by ID
  server.get('/api/v1/history/:executionId', {
    schema: {
      summary: 'Get execution details',
      description: 'Get details for a specific task execution',
      tags: ['History'],
      params: {
        type: 'object',
        properties: {
          executionId: { type: 'string' }
        },
        required: ['executionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            executionId: { type: 'string' },
            taskType: { type: 'string' },
            parameters: { 
              type: 'object',
              additionalProperties: true
            },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            duration: { type: 'number' },
            success: { type: 'boolean' },
            result: { 
              type: 'object',
              additionalProperties: true,
              nullable: true 
            },
            error: { 
              type: 'string',
              nullable: true 
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { executionId } = request.params;
      
      try {
        // Get all history and find the specific execution
        const { history } = await server.scheduler.getHistory(null, { limit: 1000 });
        
        const execution = history.find(entry => entry.executionId === executionId);
        
        if (!execution) {
          return reply.status(404).send({
            status: 'error',
            message: `Execution with ID '${executionId}' not found`
          });
        }
        
        return execution;
      } catch (error) {
        logger.error('Error fetching execution details', {
          executionId,
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to fetch execution details: ${error.message}`
        });
      }
    }
  });
}