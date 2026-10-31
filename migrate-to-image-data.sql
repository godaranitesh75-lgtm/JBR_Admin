-- Migration: Rename image_url to image_data
-- This migrates the products table to store base64 image data instead of URLs
-- Run this on your Neon PostgreSQL database

-- Step 1: Rename the column
ALTER TABLE products RENAME COLUMN image_url TO image_data;

-- Step 2: Update the column comment for clarity
COMMENT ON COLUMN products.image_data IS 'Base64-encoded image data (data:image/jpeg;base64,... format)';

-- Done! The column is now ready to store base64 image data.
-- Existing URL values will be preserved (you can manually clear them or convert them later).
