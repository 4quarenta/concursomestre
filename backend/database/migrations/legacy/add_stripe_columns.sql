-- Stripe Payment Integration - Database Migrations
-- Run this SQL in your MySQL database

-- Add Stripe-related columns to transactions table
ALTER TABLE transactions 
ADD COLUMN stripe_payment_intent_id VARCHAR(255) AFTER id,
ADD COLUMN stripe_transfer_id VARCHAR(255),
ADD COLUMN payment_status ENUM('pending', 'processing', 'succeeded', 'failed', 'refunded') DEFAULT 'pending',
ADD COLUMN payment_method VARCHAR(50),
ADD COLUMN stripe_customer_id VARCHAR(255);

-- Add Stripe account info to users table (for sellers)
ALTER TABLE users
ADD COLUMN stripe_account_id VARCHAR(255),
ADD COLUMN stripe_onboarding_complete BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX idx_stripe_payment_intent ON transactions(stripe_payment_intent_id);
CREATE INDEX idx_stripe_account ON users(stripe_account_id);

-- Verify changes
DESCRIBE transactions;
DESCRIBE users;
