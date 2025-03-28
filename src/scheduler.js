import cron from 'node-cron';
import { TaskExecutor } from './utils/task-executor.js';
import logger from './utils/logger.js';
import { saveTaskHistory, getTaskHistory } from './models/task-history.js';
import { EventEmitter } from 'events';

/**
 * Core scheduler service responsible for managing and executing scheduled tasks
 */
export function setupScheduler(taskDefinitions) {
  // Use an EventEmitter for task events
  const eventEmitter = new EventEmitter();
  
  // Active scheduled jobs
  const scheduledJobs = new Map();
  
  // Task executor
  const taskExecutor = new TaskExecutor(taskDefinitions);
  
  // Flag to track service readiness
  let ready = false;
  
  // Initialize the scheduler service
  const initialize = async () => {
    logger.info('Initializing scheduler service');
    
    try {
      // Schedule all tasks defined with cronSchedule
      Object.entries(taskDefinitions).forEach(([taskType, definition]) => {
        if (definition.cronSchedule) {
          scheduleTask(taskType, definition.cronSchedule);
        }
      });
      
      // Set service as ready
      ready = true;
      logger.info('Scheduler service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduler service', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  };
  
  /**
   * Schedule a task using node-cron
   * @param {string} taskType - The type of task to schedule
   * @param {string} cronExpression - The cron expression for scheduling
   */
  const scheduleTask = (taskType, cronExpression) => {
    try {
      // Validate the task type exists
      if (!taskDefinitions[taskType]) {
        throw new Error(`Unknown task type: ${taskType}`);
      }
      
      // Validate the cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression} for task ${taskType}`);
      }
      
      // If this task is already scheduled, stop the previous schedule
      if (scheduledJobs.has(taskType)) {
        scheduledJobs.get(taskType).stop();
        logger.info(`Stopped previous schedule for task ${taskType}`);
      }
      
      // Create a new scheduled job
      const job = cron.schedule(cronExpression, async () => {
        logger.info(`Running scheduled task: ${taskType}`, { 
          taskType, 
          scheduledTime: new Date().toISOString() 
        });
        
        try {
          // Execute the task with default parameters
          const result = await executeTask(taskType, {});
          logger.info(`Completed scheduled task: ${taskType}`, { 
            taskType, 
            success: result.success,
            duration: result.duration 
          });
        } catch (error) {
          logger.error(`Failed to execute scheduled task: ${taskType}`, { 
            taskType, 
            error: error.message, 
            stack: error.stack 
          });
        }
      });
      
      // Store the job for later reference
      scheduledJobs.set(taskType, job);
      
      logger.info(`Scheduled task ${taskType} with cron expression ${cronExpression}`);
      return true;
    } catch (error) {
      logger.error(`Failed to schedule task ${taskType}`, { 
        taskType, 
        cronExpression, 
        error: error.message, 
        stack: error.stack 
      });
      
      throw error;
    }
  };
  
  /**
   * Execute a task immediately
   * @param {string} taskType - The type of task to execute
   * @param {Object} parameters - The parameters for the task
   * @returns {Promise<Object>} The result of the task execution
   */
  const executeTask = async (taskType, parameters = {}) => {
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    logger.info(`Executing task ${taskType}`, { 
      taskType, 
      executionId, 
      parameters: JSON.stringify(parameters) 
    });
    
    try {
      // Emit task start event
      eventEmitter.emit('taskStart', { taskType, executionId, startTime, parameters });
      
      // Execute the task
      const result = await taskExecutor.execute(taskType, parameters, executionId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Save task execution history
      await saveTaskHistory({
        executionId,
        taskType,
        parameters,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        success: true,
        result: result || {},
        error: null
      });
      
      // Emit task success event
      eventEmitter.emit('taskSuccess', { 
        taskType, 
        executionId, 
        startTime, 
        endTime, 
        duration, 
        result 
      });
      
      logger.info(`Task ${taskType} executed successfully`, { 
        taskType, 
        executionId, 
        duration,
        success: true
      });
      
      return { 
        executionId, 
        success: true, 
        startTime, 
        endTime, 
        duration, 
        result 
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Save task execution failure
      await saveTaskHistory({
        executionId,
        taskType,
        parameters,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration,
        success: false,
        result: null,
        error: error.message
      });
      
      // Emit task failure event
      eventEmitter.emit('taskFailure', { 
        taskType, 
        executionId, 
        startTime, 
        endTime, 
        duration, 
        error: error.message 
      });
      
      logger.error(`Task ${taskType} execution failed`, { 
        taskType, 
        executionId, 
        error: error.message, 
        stack: error.stack, 
        duration 
      });
      
      throw error;
    }
  };
  
  /**
   * Get task history
   * @param {string} taskType - Optional task type to filter history
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise<Array>} The task execution history
   */
  const getHistory = async (taskType, options = {}) => {
    return getTaskHistory(taskType, options);
  };
  
  /**
   * Shutdown the scheduler service gracefully
   */
  const shutdown = async () => {
    logger.info('Shutting down scheduler service');
    
    // Stop all scheduled jobs
    for (const [taskType, job] of scheduledJobs.entries()) {
      job.stop();
      logger.info(`Stopped scheduled job for task ${taskType}`);
    }
    
    // Clear the scheduled jobs map
    scheduledJobs.clear();
    
    // Mark as not ready
    ready = false;
    
    logger.info('Scheduler service shut down successfully');
    return true;
  };
  
  /**
   * Check if the scheduler service is ready
   * @returns {boolean} Whether the service is ready
   */
  const isReady = () => ready;
  
  // Initialize the scheduler
  initialize().catch(error => {
    logger.error('Failed to initialize scheduler service', { 
      error: error.message, 
      stack: error.stack 
    });
  });
  
  // Return the public API
  return {
    scheduleTask,
    executeTask,
    getHistory,
    isReady,
    shutdown,
    eventEmitter,
    // Expose the task definitions
    getTaskDefinitions: () => ({ ...taskDefinitions })
  };
}