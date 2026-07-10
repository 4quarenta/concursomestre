-- Add meta_carreira column to filters table
-- This column is used to distinguish between careers/areas (meta_carreira=1) and specific roles (meta_carreira=0)
-- Similar to meta_materia which distinguishes between subjects and topics

ALTER TABLE filters 
ADD COLUMN meta_carreira TINYINT(1) DEFAULT 0 AFTER meta_materia;

-- Optional: Add index for better query performance
CREATE INDEX idx_meta_carreira ON filters(meta_carreira);

-- Verify the column was added
DESCRIBE filters;
