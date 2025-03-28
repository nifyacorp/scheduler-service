import pg from 'pg';
import { config } from '../config/index.js';
import logger from './logger.js';

// Create a PostgreSQL pool
const pool = new pg.Pool({
  ...config.database,
  // Add application name for connection
  application_name: 'nifya-scheduler-service',
});

// Pool error handler
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', {
    error: err.message,
    stack: err.stack,
  });
});

// Helper for transaction management
const beginTransaction = async (client) => {
  return client.query('BEGIN');
};

const commitTransaction = async (client) => {
  return client.query('COMMIT');
};

const rollbackTransaction = async (client) => {
  return client.query('ROLLBACK');
};

// Database interface
const db = {
  /**
   * Execute a query with parameters
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', {
        query: text,
        duration,
        rows: res.rowCount,
      });
      
      return res;
    } catch (err) {
      logger.error('Query error', {
        query: text,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  },

  /**
   * Get a client from the pool and execute a callback
   * @param {Function} callback - Callback that receives the client
   * @returns {Promise<any>} Result of the callback
   */
  withClient: async (callback) => {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  },

  /**
   * Execute a callback within a transaction
   * @param {Function} callback - Callback that receives the client
   * @returns {Promise<any>} Result of the callback
   */
  withTransaction: async (callback) => {
    return db.withClient(async (client) => {
      try {
        await beginTransaction(client);
        const result = await callback(client);
        await commitTransaction(client);
        return result;
      } catch (err) {
        await rollbackTransaction(client);
        throw err;
      }
    });
  },

  /**
   * Test the database connection
   * @returns {Promise<boolean>} True if connected
   */
  testConnection: async () => {
    try {
      const res = await pool.query('SELECT NOW()');
      return res.rows.length > 0;
    } catch (err) {
      logger.error('Database connection test failed', {
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  },

  /**
   * Close the database pool
   * @returns {Promise<void>}
   */
  close: async () => {
    try {
      await pool.end();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error('Error closing database pool', {
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  },
};

export default db;