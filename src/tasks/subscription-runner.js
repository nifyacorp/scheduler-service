import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Process all active subscriptions to check for new matches
 * @param {Object} parameters - Task parameters
 * @param {Object} context - Task execution context
 * @returns {Promise<Object>} Task result
 */
export async function subscriptionRunner(parameters, context) {
  const { batchSize = 10, subscriptionType, specificIds } = parameters;
  const { logger, executionId } = context;
  
  logger.info('Starting subscription runner task', {
    batchSize,
    subscriptionType: subscriptionType || 'all',
    specificIds: specificIds ? specificIds.length : 'none',
    executionId
  });
  
  // 1. Retrieve active subscriptions from the backend
  let subscriptionsResponse;
  try {
    // Create API URL with parameters
    let apiUrl = `${config.services.backend}/api/v1/admin/subscriptions/active?limit=${batchSize}`;
    
    if (subscriptionType) {
      apiUrl += `&type=${subscriptionType}`;
    }
    
    if (specificIds && specificIds.length > 0) {
      apiUrl += `&ids=${specificIds.join(',')}`;
    }
    
    logger.debug(`Requesting active subscriptions from backend: ${apiUrl}`);
    
    subscriptionsResponse = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${config.auth.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!subscriptionsResponse.data.subscriptions || !Array.isArray(subscriptionsResponse.data.subscriptions)) {
      throw new Error('Invalid response format from backend');
    }
    
  } catch (error) {
    logger.error('Failed to retrieve active subscriptions', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    throw new Error(`Failed to retrieve subscriptions: ${error.message}`);
  }
  
  const subscriptions = subscriptionsResponse.data.subscriptions;
  logger.info(`Retrieved ${subscriptions.length} active subscriptions`);
  
  if (subscriptions.length === 0) {
    logger.info('No active subscriptions to process');
    return { 
      processed: 0,
      successful: 0,
      failed: 0
    };
  }
  
  // 2. Process each subscription
  const results = await Promise.allSettled(
    subscriptions.map(subscription => processSubscription(subscription, context))
  );
  
  // 3. Analyze results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  // Collect error details for failed subscriptions
  const errors = results
    .map((result, index) => {
      if (result.status === 'rejected') {
        return {
          subscriptionId: subscriptions[index].id,
          error: result.reason.message
        };
      }
      return null;
    })
    .filter(Boolean);
  
  logger.info(`Subscription runner task completed`, {
    total: subscriptions.length,
    successful,
    failed,
    executionId
  });
  
  if (failed > 0) {
    logger.warn(`${failed} subscriptions failed to process`, {
      errors,
      executionId
    });
  }
  
  return {
    processed: subscriptions.length,
    successful,
    failed,
    errors
  };
}

/**
 * Process a single subscription
 * @param {Object} subscription - Subscription data
 * @param {Object} context - Task execution context
 * @returns {Promise<Object>} Processing result
 */
async function processSubscription(subscription, context) {
  const { logger } = context;
  
  logger.debug(`Processing subscription: ${subscription.id}`, {
    subscriptionId: subscription.id,
    type: subscription.type,
    userId: subscription.userId
  });
  
  try {
    // Call the subscription worker to process this subscription
    const processingUrl = `${config.services.subscriptionWorker}/subscriptions/process-subscription/${subscription.id}`;
    
    logger.debug(`Calling subscription worker: ${processingUrl}`);
    
    const response = await axios.post(processingUrl, {}, {
      headers: {
        'Authorization': `Bearer ${config.auth.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    logger.debug(`Subscription processed successfully: ${subscription.id}`, {
      subscriptionId: subscription.id,
      status: response.status,
      data: response.data
    });
    
    return {
      subscriptionId: subscription.id,
      status: 'success',
      result: response.data
    };
  } catch (error) {
    logger.error(`Failed to process subscription: ${subscription.id}`, {
      subscriptionId: subscription.id,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    throw new Error(`Failed to process subscription ${subscription.id}: ${error.message}`);
  }
}