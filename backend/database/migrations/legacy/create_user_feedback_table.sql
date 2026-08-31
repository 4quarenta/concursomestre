-- Criar tabela user_feedback para sistema de feedback e suporte
CREATE TABLE IF NOT EXISTS user_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type ENUM('cancellation', 'support', 'report', 'suggestion', 'bug', 'other') DEFAULT 'support',
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status ENUM('new', 'read', 'resolved') DEFAULT 'new',
    public_rating TINYINT NULL,
    public_display_name VARCHAR(120) NULL,
    public_headline VARCHAR(180) NULL,
    public_photo_url VARCHAR(500) NULL,
    home_published_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
