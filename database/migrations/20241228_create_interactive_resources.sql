-- Migration: Create interactive_resources table
-- Date: 2024-12-28
-- Purpose: Support interactive resources feature (OBJETIVO 2 - OPCIÓN A)

CREATE TABLE IF NOT EXISTS interactive_resources (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '{}',
  origin JSONB NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_interactive_resources_origin ON interactive_resources USING GIN (origin);
CREATE INDEX IF NOT EXISTS idx_interactive_resources_status ON interactive_resources (status);
CREATE INDEX IF NOT EXISTS idx_interactive_resources_type ON interactive_resources (resource_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_interactive_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_interactive_resources_updated_at
  BEFORE UPDATE ON interactive_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_interactive_resources_updated_at();





