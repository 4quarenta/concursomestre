-- Add cache_settings table for storing cache configuration
CREATE TABLE IF NOT EXISTS cache_settings (
    id INT PRIMARY KEY DEFAULT 1,
    enabled TINYINT(1) DEFAULT 1,
    default_ttl INT DEFAULT 300,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO cache_settings (id, enabled, default_ttl) VALUES (1, 1, 300)
ON DUPLICATE KEY UPDATE id=id;

-- Add index for faster lookups (though we only have 1 row)
CREATE INDEX idx_cache_enabled ON cache_settings(enabled);
