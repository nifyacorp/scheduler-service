import { z } from 'zod';
import { getTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate } from '../models/template.js';
import logger from '../utils/logger.js';

/**
 * Register template-related routes
 * @param {FastifyInstance} server - The Fastify server instance
 */
export function registerTemplateRoutes(server) {
  // Get all templates
  server.get('/api/v1/templates', {
    schema: {
      summary: 'List templates',
      description: 'Get a list of all templates with filtering options',
      tags: ['Templates'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          type: { type: 'string' },
          isPublic: { type: 'boolean' },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt', 'usageCount'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  type: { type: 'string' },
                  prompts: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  icon: { type: 'string' },
                  logo: { type: 'string' },
                  isPublic: { type: 'boolean' },
                  isBuiltIn: { type: 'boolean' },
                  metadata: { type: 'object', additionalProperties: true },
                  frequency: { type: 'string' },
                  createdBy: { type: 'string' },
                  creatorName: { type: 'string', nullable: true },
                  usageCount: { type: 'integer' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasMore: { type: 'boolean' }
              }
            }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const options = {
          page: parseInt(request.query.page || '1', 10),
          limit: parseInt(request.query.limit || '20', 10),
          type: request.query.type,
          isPublic: request.query.isPublic !== undefined 
            ? request.query.isPublic === 'true' 
            : undefined,
          sortBy: request.query.sortBy || 'createdAt',
          sortOrder: request.query.sortOrder || 'desc',
          userId: request.user.id
        };
        
        const result = await getTemplates(options);
        
        return result;
      } catch (error) {
        logger.error('Error listing templates', {
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to list templates: ${error.message}`
        });
      }
    }
  });
  
  // Get template by ID
  server.get('/api/v1/templates/:id', {
    schema: {
      summary: 'Get template',
      description: 'Get a specific template by ID',
      tags: ['Templates'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' },
            prompts: {
              type: 'array',
              items: { type: 'string' }
            },
            icon: { type: 'string' },
            logo: { type: 'string' },
            isPublic: { type: 'boolean' },
            isBuiltIn: { type: 'boolean' },
            metadata: { type: 'object', additionalProperties: true },
            frequency: { type: 'string' },
            createdBy: { type: 'string' },
            creatorName: { type: 'string', nullable: true },
            usageCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
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
      try {
        const template = await getTemplateById(request.params.id, request.user.id);
        
        if (!template) {
          return reply.status(404).send({
            status: 'error',
            message: 'Template not found'
          });
        }
        
        return template;
      } catch (error) {
        logger.error('Error getting template', {
          error: error.message,
          stack: error.stack,
          templateId: request.params.id,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to get template: ${error.message}`
        });
      }
    }
  });
  
  // Create template
  server.post('/api/v1/templates', {
    schema: {
      summary: 'Create template',
      description: 'Create a new template',
      tags: ['Templates'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
          prompts: {
            type: 'array',
            items: { type: 'string' }
          },
          icon: { type: 'string' },
          logo: { type: 'string' },
          isPublic: { type: 'boolean' },
          metadata: { type: 'object', additionalProperties: true },
          frequency: { type: 'string', enum: ['immediate', 'daily'] }
        },
        required: ['name', 'description', 'type', 'prompts']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' },
            prompts: {
              type: 'array',
              items: { type: 'string' }
            },
            icon: { type: 'string' },
            logo: { type: 'string' },
            isPublic: { type: 'boolean' },
            isBuiltIn: { type: 'boolean' },
            metadata: { type: 'object', additionalProperties: true },
            frequency: { type: 'string' },
            createdBy: { type: 'string' },
            creatorName: { type: 'string', nullable: true },
            usageCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        400: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    handler: async (request, reply) => {
      try {
        // Validate input using Zod
        const schema = z.object({
          name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
          description: z.string().min(1, 'Description is required').max(500, 'Description is too long'),
          type: z.enum(['boe', 'real-estate', 'custom'], {
            errorMap: () => ({ message: 'Type must be one of: boe, real-estate, custom' })
          }),
          prompts: z.array(z.string()).min(1, 'At least one prompt is required'),
          icon: z.string().optional(),
          logo: z.string().optional(),
          isPublic: z.boolean().optional(),
          metadata: z.record(z.any()).optional(),
          frequency: z.enum(['immediate', 'daily'], {
            errorMap: () => ({ message: 'Frequency must be one of: immediate, daily' })
          }).optional()
        });
        
        // Parse and validate the request body
        const validatedData = schema.parse(request.body);
        
        // Create the template
        const template = await createTemplate(validatedData, request.user.id);
        
        return reply.status(201).send(template);
      } catch (error) {
        // Check if it's a Zod validation error
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }
        
        logger.error('Error creating template', {
          error: error.message,
          stack: error.stack,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to create template: ${error.message}`
        });
      }
    }
  });
  
  // Update template
  server.put('/api/v1/templates/:id', {
    schema: {
      summary: 'Update template',
      description: 'Update an existing template',
      tags: ['Templates'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['boe', 'real-estate', 'custom'] },
          prompts: {
            type: 'array',
            items: { type: 'string' }
          },
          icon: { type: 'string' },
          logo: { type: 'string' },
          isPublic: { type: 'boolean' },
          metadata: { type: 'object', additionalProperties: true },
          frequency: { type: 'string', enum: ['immediate', 'daily'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string' },
            prompts: {
              type: 'array',
              items: { type: 'string' }
            },
            icon: { type: 'string' },
            logo: { type: 'string' },
            isPublic: { type: 'boolean' },
            isBuiltIn: { type: 'boolean' },
            metadata: { type: 'object', additionalProperties: true },
            frequency: { type: 'string' },
            createdBy: { type: 'string' },
            creatorName: { type: 'string', nullable: true },
            usageCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
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
      try {
        // Validate input using Zod
        const schema = z.object({
          name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
          description: z.string().min(1, 'Description is required').max(500, 'Description is too long').optional(),
          type: z.enum(['boe', 'real-estate', 'custom'], {
            errorMap: () => ({ message: 'Type must be one of: boe, real-estate, custom' })
          }).optional(),
          prompts: z.array(z.string()).min(1, 'At least one prompt is required').optional(),
          icon: z.string().optional(),
          logo: z.string().optional(),
          isPublic: z.boolean().optional(),
          metadata: z.record(z.any()).optional(),
          frequency: z.enum(['immediate', 'daily'], {
            errorMap: () => ({ message: 'Frequency must be one of: immediate, daily' })
          }).optional()
        });
        
        // Parse and validate the request body
        const validatedData = schema.parse(request.body);
        
        // Update the template
        const template = await updateTemplate(request.params.id, validatedData, request.user.id);
        
        return template;
      } catch (error) {
        // Check if it's a Zod validation error
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            status: 'error',
            message: 'Validation error',
            errors: error.errors
          });
        }
        
        // Check for not found or permission errors
        if (error.message.includes('not found') || error.message.includes('permission')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }
        
        logger.error('Error updating template', {
          error: error.message,
          stack: error.stack,
          templateId: request.params.id,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to update template: ${error.message}`
        });
      }
    }
  });
  
  // Delete template
  server.delete('/api/v1/templates/:id', {
    schema: {
      summary: 'Delete template',
      description: 'Delete an existing template',
      tags: ['Templates'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
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
      try {
        const success = await deleteTemplate(request.params.id, request.user.id);
        
        if (!success) {
          return reply.status(404).send({
            status: 'error',
            message: 'Template not found or you don\'t have permission to delete it'
          });
        }
        
        return {
          status: 'success',
          message: 'Template deleted successfully'
        };
      } catch (error) {
        // Check for specific error types
        if (error.message.includes('not found') || error.message.includes('permission')) {
          return reply.status(404).send({
            status: 'error',
            message: error.message
          });
        }
        
        if (error.message.includes('in use')) {
          return reply.status(400).send({
            status: 'error',
            message: error.message
          });
        }
        
        logger.error('Error deleting template', {
          error: error.message,
          stack: error.stack,
          templateId: request.params.id,
          requestId: request.id
        });
        
        return reply.status(500).send({
          status: 'error',
          message: `Failed to delete template: ${error.message}`
        });
      }
    }
  });
}