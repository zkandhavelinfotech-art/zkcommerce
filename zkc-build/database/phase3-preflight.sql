-- Values used by the API and phase-three views. Enum values must be committed
-- before later migrations can safely use them, so this is a separate file.
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'archived';
