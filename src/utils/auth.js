import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import logger from './logger.js';

/**
 * Authenticate requests using API key or JWT
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 */
export async function authMiddleware(request, reply) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return reply.status(401).send({
        status: 'error',
        message: 'Authorization header missing'
      });
    }
    
    // Check for API key (used by Cloud Scheduler and other services)
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      // Check if it's an API key
      if (token === config.auth.apiKey) {
        request.user = { 
          id: 'system',
          role: 'system',
          isSystem: true
        };
        return;
      }
      
      // Otherwise, treat it as a JWT
      try {
        const decoded = jwt.verify(token, config.auth.secret);
        request.user = decoded;
        return;
      } catch (error) {
        logger.warn('Invalid JWT token', {
          error: error.message,
          requestId: request.id
        });
        
        return reply.status(401).send({
          status: 'error',
          message: 'Invalid token'
        });
      }
    }
    
    // If we get here, the authorization header is invalid
    return reply.status(401).send({
      status: 'error',
      message: 'Invalid authorization header format'
    });
  } catch (error) {
    logger.error('Error in auth middleware', {
      error: error.message,
      stack: error.stack,
      requestId: request.id
    });
    
    return reply.status(500).send({
      status: 'error',
      message: 'Authentication error'
    });
  }
}