-- Task history table
CREATE TABLE IF NOT EXISTS task_history (
  id VARCHAR(255) PRIMARY KEY,
  execution_id VARCHAR(255) NOT NULL,
  task_type VARCHAR(255) NOT NULL,
  parameters JSONB,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_history_task_type ON task_history (task_type);
CREATE INDEX IF NOT EXISTS idx_task_history_execution_id ON task_history (execution_id);
CREATE INDEX IF NOT EXISTS idx_task_history_start_time ON task_history (start_time);
CREATE INDEX IF NOT EXISTS idx_task_history_success ON task_history (success);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  prompts JSONB NOT NULL,
  icon VARCHAR(50),
  logo TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates (type);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates (created_by);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates (is_public);

-- Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE
ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create initial built-in templates
INSERT INTO templates (id, name, description, type, prompts, icon, logo, is_public, is_built_in, metadata, frequency, created_by, created_at, updated_at)
VALUES
  (
    'boe-general',
    'BOE General',
    'General subscription for the Spanish Official State Gazette (BOE)',
    'boe',
    '["disposición", "ley", "real decreto"]',
    'FileText',
    'https://www.boe.es/favicon.ico',
    TRUE,
    TRUE,
    '{"category": "government", "source": "boe"}',
    'daily',
    'system',
    NOW(),
    NOW()
  ),
  (
    'boe-subvenciones',
    'BOE Subvenciones',
    'Track grants and subsidies in the Spanish Official State Gazette (BOE)',
    'boe',
    '["subvención", "ayuda", "convocatoria"]',
    'FileText',
    'https://www.boe.es/favicon.ico',
    TRUE,
    TRUE,
    '{"category": "government", "source": "boe"}',
    'daily',
    'system',
    NOW(),
    NOW()
  ),
  (
    'real-estate-rental',
    'Alquiler de Viviendas',
    'Track rental properties in specific areas',
    'real-estate',
    '["alquiler", "piso", "apartamento"]',
    'Building2',
    'https://example.com/icon.png',
    TRUE,
    TRUE,
    '{"category": "real-estate", "source": "property-listings"}',
    'immediate',
    'system',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;