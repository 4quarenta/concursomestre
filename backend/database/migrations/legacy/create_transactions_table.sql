-- Create transactions table for marketplace purchases
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    material_id VARCHAR(50) NOT NULL,
    seller_id VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    payment_method VARCHAR(50),
    external_id VARCHAR(100),
    stripe_payment_intent_id VARCHAR(100),
    installments INT DEFAULT 1,
    payer_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_material_id (material_id),
    INDEX idx_seller_id (seller_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
