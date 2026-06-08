-- ============================================================
-- Famsops v2 — Migration 004
-- Fix: add technician_id to users for technician-linked auth context
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS technician_id TEXT
  REFERENCES technicians(tech_id) ON DELETE SET NULL;
