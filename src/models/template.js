import db from '../utils/database.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all templates with optional filtering
 * @param {Object} options - Query options
 * @returns {Promise<Array>} List of templates
 */
export async function getTemplates(options = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    userId,
    isPublic,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;

  try {
    // Start building the query
    let query = `
      SELECT t.*, 
             u.name as creator_name,
             u.email as creator_email,
             (SELECT COUNT(*) FROM subscriptions WHERE template_id = t.id) as usage_count
      FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Add filters
    if (type) {
      query += ` AND t.type = $${params.length + 1}`;
      params.push(type);
    }
    
    if (userId) {
      query += ` AND (t.created_by = $${params.length + 1} OR t.is_public = true)`;
      params.push(userId);
    } else if (isPublic !== undefined) {
      query += ` AND t.is_public = $${params.length + 1}`;
      params.push(isPublic);
    }
    
    // Add sorting
    query += ` ORDER BY t.${sortBy} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM templates t
      WHERE 1=1
    `;
    
    const countParams = [];
    
    // Add the same filters to count query
    if (type) {
      countQuery += ` AND t.type = $${countParams.length + 1}`;
      countParams.push(type);
    }
    
    if (userId) {
      countQuery += ` AND (t.created_by = $${countParams.length + 1} OR t.is_public = true)`;
      countParams.push(userId);
    } else if (isPublic !== undefined) {
      countQuery += ` AND t.is_public = $${countParams.length + 1}`;
      countParams.push(isPublic);
    }
    
    // Execute queries
    const [templatesResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams)
    ]);
    
    const templates = templatesResult.rows.map(formatTemplate);
    const total = parseInt(countResult.rows[0].total, 10);
    
    return {
      templates,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + templates.length < total
      }
    };
  } catch (error) {
    logger.error('Error fetching templates', {
      error: error.message,
      stack: error.stack,
      options
    });
    throw error;
  }
}

/**
 * Get a single template by ID
 * @param {string} id - Template ID
 * @param {string} userId - Optional user ID for permission check
 * @returns {Promise<Object>} Template data
 */
export async function getTemplateById(id, userId = null) {
  try {
    const query = `
      SELECT t.*, 
             u.name as creator_name,
             u.email as creator_email,
             (SELECT COUNT(*) FROM subscriptions WHERE template_id = t.id) as usage_count
      FROM templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
        ${userId ? 'AND (t.created_by = $2 OR t.is_public = true)' : ''}
    `;
    
    const params = [id];
    if (userId) {
      params.push(userId);
    }
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return formatTemplate(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching template by ID', {
      error: error.message,
      stack: error.stack,
      templateId: id,
      userId
    });
    throw error;
  }
}

/**
 * Create a new template
 * @param {Object} templateData - Template data
 * @param {string} userId - User ID creating the template
 * @returns {Promise<Object>} Created template
 */
export async function createTemplate(templateData, userId) {
  try {
    // Validate required fields
    const requiredFields = ['name', 'description', 'type', 'prompts'];
    for (const field of requiredFields) {
      if (!templateData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Generate a new ID
    const templateId = uuidv4();
    
    // Set defaults for optional fields
    const isPublic = templateData.isPublic !== undefined ? templateData.isPublic : false;
    const icon = templateData.icon || templateData.type === 'boe' ? 'FileText' : 
                 templateData.type === 'real-estate' ? 'Building2' : 'Bell';
    const logo = templateData.logo || '';
    
    // Set metadata
    const metadata = templateData.metadata || {
      category: templateData.type,
      source: templateData.type
    };
    
    // Prepare the query
    const query = `
      INSERT INTO templates (
        id, name, description, type, prompts, icon, logo, is_public,
        metadata, frequency, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
      RETURNING *
    `;
    
    const now = new Date().toISOString();
    const params = [
      templateId,
      templateData.name,
      templateData.description,
      templateData.type,
      JSON.stringify(templateData.prompts),
      icon,
      logo,
      isPublic,
      JSON.stringify(metadata),
      templateData.frequency || 'daily',
      userId,
      now
    ];
    
    const result = await db.query(query, params);
    
    return formatTemplate(result.rows[0]);
  } catch (error) {
    logger.error('Error creating template', {
      error: error.message,
      stack: error.stack,
      userId
    });
    throw error;
  }
}

/**
 * Update an existing template
 * @param {string} id - Template ID
 * @param {Object} templateData - Template data to update
 * @param {string} userId - User ID for permission check
 * @returns {Promise<Object>} Updated template
 */
export async function updateTemplate(id, templateData, userId) {
  try {
    // Check if the template exists and user has permission
    const existingTemplate = await getTemplateById(id, userId);
    
    if (!existingTemplate) {
      throw new Error('Template not found or you don\'t have permission to update it');
    }
    
    // Check if the user is the creator
    if (existingTemplate.createdBy !== userId) {
      throw new Error('You must be the creator of the template to update it');
    }
    
    // Build the SET clause for the update query
    const setFields = [];
    const params = [id];
    let paramIndex = 2;
    
    // Process each field
    for (const [key, value] of Object.entries(templateData)) {
      if (value !== undefined) {
        switch (key) {
          case 'name':
          case 'description':
          case 'type':
          case 'icon':
          case 'logo':
          case 'frequency':
            setFields.push(`${key} = $${paramIndex++}`);
            params.push(value);
            break;
          case 'isPublic':
            setFields.push(`is_public = $${paramIndex++}`);
            params.push(value);
            break;
          case 'prompts':
            setFields.push(`prompts = $${paramIndex++}`);
            params.push(JSON.stringify(value));
            break;
          case 'metadata':
            setFields.push(`metadata = $${paramIndex++}`);
            params.push(JSON.stringify(value));
            break;
        }
      }
    }
    
    // Always update the updated_at timestamp
    setFields.push(`updated_at = $${paramIndex++}`);
    params.push(new Date().toISOString());
    
    // If no fields to update, just return the existing template
    if (setFields.length === 0) {
      return existingTemplate;
    }
    
    // Prepare the query
    const query = `
      UPDATE templates
      SET ${setFields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, params);
    
    return formatTemplate(result.rows[0]);
  } catch (error) {
    logger.error('Error updating template', {
      error: error.message,
      stack: error.stack,
      templateId: id,
      userId
    });
    throw error;
  }
}

/**
 * Delete a template
 * @param {string} id - Template ID
 * @param {string} userId - User ID for permission check
 * @returns {Promise<boolean>} Success status
 */
export async function deleteTemplate(id, userId) {
  try {
    // Check if the template exists and user has permission
    const existingTemplate = await getTemplateById(id, userId);
    
    if (!existingTemplate) {
      throw new Error('Template not found or you don\'t have permission to delete it');
    }
    
    // Check if the user is the creator
    if (existingTemplate.createdBy !== userId) {
      throw new Error('You must be the creator of the template to delete it');
    }
    
    // Check if the template is in use
    const checkQuery = `
      SELECT COUNT(*) as count FROM subscriptions WHERE template_id = $1
    `;
    
    const checkResult = await db.query(checkQuery, [id]);
    const inUseCount = parseInt(checkResult.rows[0].count, 10);
    
    if (inUseCount > 0) {
      throw new Error(`Cannot delete template that is in use by ${inUseCount} subscriptions`);
    }
    
    // Delete the template
    const query = `DELETE FROM templates WHERE id = $1`;
    const result = await db.query(query, [id]);
    
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Error deleting template', {
      error: error.message,
      stack: error.stack,
      templateId: id,
      userId
    });
    throw error;
  }
}

/**
 * Format a template row from the database
 * @param {Object} row - Database row
 * @returns {Object} Formatted template
 */
function formatTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    prompts: row.prompts ? JSON.parse(row.prompts) : [],
    icon: row.icon,
    logo: row.logo,
    isPublic: row.is_public,
    isBuiltIn: row.is_built_in || false,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    createdBy: row.created_by,
    creatorName: row.creator_name,
    creatorEmail: row.creator_email,
    usageCount: parseInt(row.usage_count || 0, 10),
    frequency: row.frequency,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}