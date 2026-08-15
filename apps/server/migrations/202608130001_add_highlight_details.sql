-- Add reason and suggested_hook_text columns to highlights table
ALTER TABLE highlights ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE highlights ADD COLUMN suggested_hook_text TEXT NOT NULL DEFAULT '';
