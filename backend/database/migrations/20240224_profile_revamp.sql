
-- 1. Add new columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) DEFAULT NULL UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referrer_id INT NOT NULL,
    referred_id INT NOT NULL,
    status ENUM('pending', 'signed_up', 'subscribed', 'rewarded') DEFAULT 'signed_up',
    reward_type ENUM('xp', 'days', 'commission') DEFAULT 'xp',
    reward_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (referred_id) -- A user can only be referred once
);

-- 3. Populate referral codes for existing users (optional/initial)
-- This logic might be better handled in PHP during login or via a one-time script
