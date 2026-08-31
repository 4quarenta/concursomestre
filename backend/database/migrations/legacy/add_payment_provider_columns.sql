ALTER TABLE users
    ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER mercadopago_customer_id;

ALTER TABLE user_subscriptions
    ADD COLUMN payment_provider VARCHAR(50) NOT NULL DEFAULT 'mercado_pago' AFTER plan_id,
    ADD COLUMN provider_subscription_id VARCHAR(255) NULL AFTER payment_provider,
    ADD COLUMN provider_customer_id VARCHAR(255) NULL AFTER provider_subscription_id,
    ADD COLUMN provider_checkout_session_id VARCHAR(255) NULL AFTER provider_customer_id,
    ADD COLUMN cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0 AFTER auto_renew;

ALTER TABLE transactions
    ADD COLUMN payment_provider VARCHAR(50) NOT NULL DEFAULT 'mercado_pago' AFTER payment_method,
    ADD COLUMN provider_payment_intent_id VARCHAR(255) NULL AFTER payment_provider,
    ADD COLUMN provider_invoice_id VARCHAR(255) NULL AFTER provider_payment_intent_id,
    ADD COLUMN provider_refund_id VARCHAR(255) NULL AFTER provider_invoice_id,
    ADD COLUMN provider_customer_id VARCHAR(255) NULL AFTER provider_refund_id;

CREATE INDEX idx_user_subscriptions_provider_subscription
    ON user_subscriptions (provider_subscription_id);

CREATE INDEX idx_transactions_provider_payment_intent
    ON transactions (provider_payment_intent_id);

CREATE INDEX idx_transactions_provider_invoice
    ON transactions (provider_invoice_id);
