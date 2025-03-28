import logger from './logger.js';
import { z } from 'zod';

/**
 * TaskExecutor handles the validation and execution of tasks
 */
export class TaskExecutor {
  /**
   * Create a new TaskExecutor
   * @param {Object} taskDefinitions - Map of task types to their definitions
   */
  constructor(taskDefinitions) {
    this.taskDefinitions = taskDefinitions;
  }

  /**
   * Execute a task
   * @param {string} taskType - The type of task to execute
   * @param {Object} parameters - Parameters for the task
   * @param {string} executionId - Unique ID for this execution
   * @returns {Promise<Object>} Result of the task execution
   */
  async execute(taskType, parameters, executionId) {
    // Check if the task type exists
    if (!this.taskDefinitions[taskType]) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    const taskDefinition = this.taskDefinitions[taskType];

    try {
      // Validate parameters against schema
      this.validateParameters(taskDefinition, parameters);
      
      logger.debug(`Task ${taskType} parameters validated successfully`, {
        taskType,
        executionId,
        parametersValid: true
      });

      // Apply default parameters
      const mergedParameters = {
        ...taskDefinition.defaultParameters,
        ...parameters
      };

      // Set up timeout
      const timeoutMs = taskDefinition.timeoutMs || 300000; // Default 5 minutes
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task ${taskType} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Execute the handler with timeout
      const executionPromise = taskDefinition.handler(mergedParameters, {
        executionId,
        logger: this.createTaskLogger(taskType, executionId)
      });

      // Race the execution against the timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      return result;
    } catch (error) {
      logger.error(`Error executing task ${taskType}`, {
        taskType,
        executionId,
        error: error.message,
        stack: error.stack
      });

      // If we have a retry policy and should retry, handle it
      if (taskDefinition.retryPolicy && this.shouldRetry(taskDefinition.retryPolicy, error)) {
        return this.handleRetry(taskType, parameters, executionId, taskDefinition.retryPolicy, error);
      }

      throw error;
    }
  }

  /**
   * Validate task parameters against the schema
   * @param {Object} taskDefinition - The task definition
   * @param {Object} parameters - Parameters to validate
   */
  validateParameters(taskDefinition, parameters) {
    if (!taskDefinition.parametersSchema) {
      return true; // No schema to validate against
    }

    try {
      // If we have a zod schema, use it
      if (taskDefinition.parametersSchema instanceof z.ZodType) {
        taskDefinition.parametersSchema.parse(parameters);
        return true;
      }

      // Otherwise, assume it's a JSON schema
      // For simplicity, we're not implementing full JSON schema validation here
      // In a real implementation, you would use a library like ajv
      return true;
    } catch (error) {
      throw new Error(`Invalid parameters for task: ${error.message}`);
    }
  }

  /**
   * Check if we should retry a failed task
   * @param {Object} retryPolicy - The retry policy from the task definition
   * @param {Error} error - The error that occurred
   * @returns {boolean} Whether to retry the task
   */
  shouldRetry(retryPolicy, error) {
    if (!retryPolicy || !retryPolicy.maxRetries || retryPolicy.maxRetries <= 0) {
      return false;
    }

    // If we have a filter function, use it to determine if we should retry
    if (retryPolicy.retryableErrors) {
      // Check if the error matches any of the retryable errors
      return retryPolicy.retryableErrors.some(errorPattern => {
        if (typeof errorPattern === 'string') {
          return error.message.includes(errorPattern);
        } else if (errorPattern instanceof RegExp) {
          return errorPattern.test(error.message);
        }
        return false;
      });
    }

    // By default, retry all errors
    return true;
  }

  /**
   * Handle retry logic for a failed task
   * @param {string} taskType - The type of task
   * @param {Object} parameters - Parameters for the task
   * @param {string} executionId - Original execution ID
   * @param {Object} retryPolicy - The retry policy
   * @param {Error} originalError - The original error that triggered the retry
   * @returns {Promise<Object>} Result of the retry execution
   */
  async handleRetry(taskType, parameters, executionId, retryPolicy, originalError) {
    const retryState = {
      attemptsRemaining: retryPolicy.maxRetries,
      lastError: originalError,
      retryCount: 0,
      originalExecutionId: executionId
    };

    return this.retryExecution(taskType, parameters, retryState);
  }

  /**
   * Recursive function to handle retrying a task execution
   * @param {string} taskType - The type of task
   * @param {Object} parameters - Parameters for the task
   * @param {Object} retryState - State tracking the retry process
   * @returns {Promise<Object>} Result of the retry execution
   */
  async retryExecution(taskType, parameters, retryState) {
    if (retryState.attemptsRemaining <= 0) {
      throw retryState.lastError;
    }

    // Decrement attempts and increment retry count
    retryState.attemptsRemaining--;
    retryState.retryCount++;

    // Calculate delay using exponential backoff
    const taskDefinition = this.taskDefinitions[taskType];
    const baseDelay = taskDefinition.retryPolicy.baseDelayMs || 1000;
    const maxDelay = taskDefinition.retryPolicy.maxDelayMs || 30000;
    
    const delay = Math.min(
      baseDelay * Math.pow(2, retryState.retryCount - 1),
      maxDelay
    );

    logger.info(`Retrying task ${taskType} in ${delay}ms (attempt ${retryState.retryCount})`, {
      taskType,
      retryCount: retryState.retryCount,
      delayMs: delay,
      originalExecutionId: retryState.originalExecutionId,
      error: retryState.lastError.message
    });

    // Wait for the delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Generate a new execution ID for the retry
    const retryExecutionId = `retry-${retryState.retryCount}-${retryState.originalExecutionId}`;

    try {
      // Execute the task again
      return await this.execute(taskType, parameters, retryExecutionId);
    } catch (error) {
      // Update the last error
      retryState.lastError = error;
      
      // Try again recursively
      return this.retryExecution(taskType, parameters, retryState);
    }
  }

  /**
   * Create a task-specific logger
   * @param {string} taskType - The type of task
   * @param {string} executionId - Execution ID
   * @returns {Object} Logger with task context
   */
  createTaskLogger(taskType, executionId) {
    return {
      debug: (message, context = {}) => {
        logger.debug(`[Task: ${taskType}] ${message}`, {
          ...context,
          taskType,
          executionId
        });
      },
      info: (message, context = {}) => {
        logger.info(`[Task: ${taskType}] ${message}`, {
          ...context,
          taskType,
          executionId
        });
      },
      warn: (message, context = {}) => {
        logger.warn(`[Task: ${taskType}] ${message}`, {
          ...context,
          taskType,
          executionId
        });
      },
      error: (message, context = {}) => {
        logger.error(`[Task: ${taskType}] ${message}`, {
          ...context,
          taskType,
          executionId
        });
      }
    };
  }
}