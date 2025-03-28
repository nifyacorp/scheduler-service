import logger from './logger.js';

/**
 * Standardized error response handler for Fastify
 * 
 * @param {Error} error - The error that occurred
 * @param {Object} request - The Fastify request object
 * @param {Object} reply - The Fastify reply object
 */
export function errorHandler(error, request, reply) {
  // Log the error
  logger.error('API error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    requestId: request.id
  });

  // Check for validation errors
  if (error.validation || error.validationContext) {
    return reply.status(400).send({
      status: 'error',
      message: 'Validation error',
      errors: error.validation || [],
      context: error.validationContext
    });
  }

  // Handle unauthorized errors
  if (error.statusCode === 401 || error.message.includes('unauthorized')) {
    return reply.status(401).send({
      status: 'error',
      message: 'Unauthorized: Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  // Handle forbidden errors
  if (error.statusCode === 403 || error.message.includes('forbidden')) {
    return reply.status(403).send({
      status: 'error',
      message: 'Forbidden: Insufficient permissions',
      code: 'FORBIDDEN'
    });
  }

  // Handle not found errors
  if (error.statusCode === 404 || error.message.includes('not found')) {
    return reply.status(404).send({
      status: 'error',
      message: 'Resource not found',
      code: 'NOT_FOUND'
    });
  }

  // Default error response
  // Use the status code from the error if available, otherwise use 500
  const statusCode = error.statusCode || 500;
  
  return reply.status(statusCode).send({
    status: 'error',
    message: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR'
  });
}