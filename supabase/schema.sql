-- Supabase Schema for Lazada Restock & Order Reservation Monitor (V0)

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: monitored_products
CREATE TABLE IF NOT EXISTS monitored_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  product_id TEXT,
  sku_id TEXT,
  status TEXT NOT NULL DEFAULT 'MONITORING' CHECK (status IN ('IDLE', 'MONITORING', 'STOPPED', 'ERROR')),
  last_availability TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (last_availability IN ('UNKNOWN', 'OUT_OF_STOCK', 'IN_STOCK')),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: availability_events
CREATE TABLE IF NOT EXISTS availability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES monitored_products(id) ON DELETE CASCADE,
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_latency_ms INTEGER,
  raw_details JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitored_products_status ON monitored_products(status);
CREATE INDEX IF NOT EXISTS idx_availability_events_product_id ON availability_events(product_id);
CREATE INDEX IF NOT EXISTS idx_availability_events_detected_at ON availability_events(detected_at DESC);

-- Trigger to auto-update updated_at on monitored_products
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_monitored_products_updated_at
BEFORE UPDATE ON monitored_products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
