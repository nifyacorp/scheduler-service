import { z } from 'zod';
import logger from '../utils/logger.js';

/**
 * Register task-related routes
 * @param {FastifyInstance} server - The Fastify server instance
 */
export function registerTaskRoutes(server) {
  // Execute a task immediately
  server.post('/api/v1/tasks/:taskType', {
    schema: {
      summary: 'Execute a task',
      description: 'Execute a specific task immediately with provided parameters',
      tags: ['Tasks'],
      params: {
        type: 'object',
        properties: {
          taskType: { type: 'string' }
        },
        required: ['taskType']
      },
      body: {
        type: 'object',
        properties: {
          parameters: {
            type: 'object',
            additionalProperties: true
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            executionId: { type: 'string' },
            taskType: { type: 'string' },
            status: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' }
          }
        },
        400: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const { taskType } = request.params;
      const { parameters = {} } = request.body;
      
      logger.info(`Received request to execute task ${taskType}`, {
        taskType,
        parameters: JSON.stringify(parameters),
        requestId: request.id
      });
      
      // Check if the task type exists
      const taskDefinitions = server.scheduler.getTaskDefinitions();
      if (!taskDefinitions[taskType]) {
        return reply.status(404).send({
          status: 'error',
          message: `Task type '${taskType}' not found`
        });
      }
      
      try {
        // Start task execution asynchronously
        const executionResult = await server.scheduler.executeTask(taskType, parameters);
        
        return {
          executionId: executionResult.executionId,
          taskType,
          status: 'pending',
          startTime: new Date(executionResult.startTime).toISOString()
        };
      } catch (error) {
        logger.error(`Error executing task ${taskType}`, {
          taskType,
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to execute task: ${error.message}`
        });
      }
    }
  });
  
  // Get list of available tasks
  server.get('/api/v1/tasks', {
    schema: {
      summary: 'List tasks',
      description: 'Get a list of all available tasks',
      tags: ['Tasks'],
      response: {
        200: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  taskType: { type: 'string' },
                  description: { type: 'string' },
                  cronSchedule: { type: 'string', nullable: true },
                  parameters: { 
                    type: 'object',
                    additionalProperties: true
                  }
                }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      const taskDefinitions = server.scheduler.getTaskDefinitions();
      
      const tasks = Object.entries(taskDefinitions).map(([taskType, definition]) => ({
        taskType,
        description: definition.description || '',
        cronSchedule: definition.cronSchedule || null,
        parameters: definition.defaultParameters || {}
      }));
      
      return {
        tasks
      };
    }
  });
  
  // Get task execution status
  server.get('/api/v1/tasks/:taskType/status', {
    schema: {
      summary: 'Get task status',
      description: 'Get the status of a specific task type',
      tags: ['Tasks'],
      params: {
        type: 'object',
        properties: {
          taskType: { type: 'string' }
        },
        required: ['taskType']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            taskType: { type: 'string' },
            cronSchedule: { type: 'string', nullable: true },
            lastExecution: {
              type: 'object',
              properties: {
                executionId: { type: 'string' },
                startTime: { type: 'string', format: 'date-time' },
                endTime: { type: 'string', format: 'date-time', nullable: true },
                success: { type: 'boolean' },
                duration: { type: 'number' }
              },
              nullable: true
            },
            nextExecution: { 
              type: 'string', 
              format: 'date-time',
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
      const { taskType } = request.params;
      
      // Check if the task type exists
      const taskDefinitions = server.scheduler.getTaskDefinitions();
      if (!taskDefinitions[taskType]) {
        return reply.status(404).send({
          status: 'error',
          message: `Task type '${taskType}' not found`
        });
      }
      
      // Get task history for this task type
      const { history } = await server.scheduler.getHistory(taskType, { limit: 1 });
      
      // Get next execution time if there's a cron schedule
      let nextExecution = null;
      if (taskDefinitions[taskType].cronSchedule) {
        const cronParser = (await import('cron-parser')).default;
        try {
          const interval = cronParser.parseExpression(taskDefinitions[taskType].cronSchedule);
          nextExecution = interval.next().toISOString();
        } catch (error) {
          logger.warn(`Failed to parse cron expression for task ${taskType}`, {
            taskType,
            cronSchedule: taskDefinitions[taskType].cronSchedule,
            error: error.message
          });
        }
      }
      
      return {
        taskType,
        cronSchedule: taskDefinitions[taskType].cronSchedule || null,
        lastExecution: history.length > 0 ? {
          executionId: history[0].executionId,
          startTime: history[0].startTime,
          endTime: history[0].endTime,
          success: history[0].success,
          duration: history[0].duration
        } : null,
        nextExecution
      };
    }
  });
  
  // Schedule a task
  server.post('/api/v1/tasks/:taskType/schedule', {
    schema: {
      summary: 'Schedule a task',
      description: 'Schedule a task with a cron expression',
      tags: ['Tasks'],
      params: {
        type: 'object',
        properties: {
          taskType: { type: 'string' }
        },
        required: ['taskType']
      },
      body: {
        type: 'object',
        properties: {
          cronExpression: { type: 'string' }
        },
        required: ['cronExpression']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            taskType: { type: 'string' },
            cronExpression: { type: 'string' },
            nextExecution: { type: 'string', format: 'date-time' }
          }
        },
        400: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
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
      const { taskType } = request.params;
      const { cronExpression } = request.body;
      
      // Check if the task type exists
      const taskDefinitions = server.scheduler.getTaskDefinitions();
      if (!taskDefinitions[taskType]) {
        return reply.status(404).send({
          status: 'error',
          message: `Task type '${taskType}' not found`
        });
      }
      
      try {
        // Validate cron expression
        const cronParser = (await import('cron-parser')).default;
        let nextExecution;
        try {
          const interval = cronParser.parseExpression(cronExpression);
          nextExecution = interval.next().toISOString();
        } catch (error) {
          return reply.status(400).send({
            status: 'error',
            message: `Invalid cron expression: ${error.message}`
          });
        }
        
        // Schedule the task
        await server.scheduler.scheduleTask(taskType, cronExpression);
        
        return {
          status: 'success',
          taskType,
          cronExpression,
          nextExecution
        };
      } catch (error) {
        logger.error(`Error scheduling task ${taskType}`, {
          taskType,
          cronExpression,
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to schedule task: ${error.message}`
        });
      }
    }
  });
}