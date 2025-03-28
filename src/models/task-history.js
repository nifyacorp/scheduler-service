import db from '../utils/database.js';
import logger from '../utils/logger.js';

// In-memory array for task history while DB is not set up
let taskHistoryArray = [];

/**
 * Save task execution history to the database
 * @param {Object} historyEntry - The task history entry to save
 * @returns {Promise<Object>} The saved history entry
 */
export async function saveTaskHistory(historyEntry) {
  try {
    // In a full implementation, this would be saved to a database
    // For now, we'll save it to an in-memory array
    const entry = { 
      ...historyEntry,
      id: `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    taskHistoryArray.push(entry);
    
    // Limit the size of the array to prevent memory issues
    if (taskHistoryArray.length > 1000) {
      taskHistoryArray = taskHistoryArray.slice(taskHistoryArray.length - 1000);
    }
    
    logger.debug(`Saved task history entry for ${historyEntry.taskType}`, {
      taskType: historyEntry.taskType,
      executionId: historyEntry.executionId,
      success: historyEntry.success
    });
    
    return entry;
  } catch (error) {
    logger.error(`Failed to save task history for ${historyEntry.taskType}`, {
      taskType: historyEntry.taskType,
      executionId: historyEntry.executionId,
      error: error.message,
      stack: error.stack
    });
    
    // Even if saving fails, we don't want to fail the entire operation
    return historyEntry;
  }
}

/**
 * Get task execution history
 * @param {string} taskType - Optional task type to filter the history
 * @param {Object} options - Query options (limit, offset, etc.)
 * @returns {Promise<Array>} The task execution history
 */
export async function getTaskHistory(taskType, options = {}) {
  try {
    const { limit = 10, offset = 0, sortBy = 'startTime', sortOrder = 'desc' } = options;
    
    // Filter by task type if provided
    let filteredHistory = taskType 
      ? taskHistoryArray.filter(entry => entry.taskType === taskType)
      : taskHistoryArray;
    
    // Sort the history entries
    filteredHistory.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder.toLowerCase() === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });
    
    // Apply pagination
    const paginatedHistory = filteredHistory.slice(offset, offset + limit);
    
    return {
      history: paginatedHistory,
      pagination: {
        total: filteredHistory.length,
        limit,
        offset,
        hasMore: offset + limit < filteredHistory.length
      }
    };
  } catch (error) {
    logger.error('Failed to get task execution history', {
      taskType,
      options,
      error: error.message,
      stack: error.stack
    });
    
    // Return empty result on error
    return {
      history: [],
      pagination: {
        total: 0,
        limit: options.limit || 10,
        offset: options.offset || 0,
        hasMore: false
      }
    };
  }
}