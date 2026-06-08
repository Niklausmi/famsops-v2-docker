-- ============================================================
-- Famsops v2 — Migration 006: Lead Vehicle Details & Images
-- Adds: plate number, make, model, color, chassis number, and image attachments to leads
-- ============================================================

-- 1. Add Vehicle Detail Columns to leads table
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS plate_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_make  TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
  ADD COLUMN IF NOT EXISTS chassis_no    TEXT,
  ADD COLUMN IF NOT EXISTS images        TEXT[]; -- Array of image URLs/paths

-- 2. Also add to tickets table since 'Lead' type tickets exist
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS plate_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_make  TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
  ADD COLUMN IF NOT EXISTS chassis_no    TEXT,
  ADD COLUMN IF NOT EXISTS images        TEXT[];
