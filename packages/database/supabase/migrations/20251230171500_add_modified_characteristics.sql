-- Add column to track which characteristics have been modified by injuries
-- This will be a text array like ['MA', 'ST', 'AG'] to show which stats have 🩹
ALTER TABLE players ADD COLUMN modified_characteristics TEXT[] DEFAULT '{}';
