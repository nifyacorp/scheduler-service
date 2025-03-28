import { createServer } from './server.js';
import { setupScheduler } from './scheduler.js';
import { loadTasks } from './tasks/index.js';
import logger from './utils/logger.js';
import { config } from './config/index.js';

// Start the application
async function start() {
  try {
    // Load task definitions
    const tasks = loadTasks();
    logger.info(`Loaded ${Object.keys(tasks).length} task definitions`);

    // Initialize and start scheduler
    const scheduler = setupScheduler(tasks);
    logger.info('Scheduler initialized');

    // Create and start server
    const server = await createServer(scheduler);
    await server.listen({ port: config.port, host: '0.0.0.0' });
    
    logger.info(`Server listening on port ${config.port}`);
    
    // Handle graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      await scheduler.shutdown();
      await server.close();
      logger.info('Server and scheduler shut down successfully');
      process.exit(0);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start application', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start the application
start().catch(error => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});