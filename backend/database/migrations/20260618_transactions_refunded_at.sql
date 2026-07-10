-- Add explicit refund completion timestamp used by financial reconciliation.
-- Safe to run once after checking the column does not already exist.
ALTER TABLE transactions
    ADD COLUMN refunded_at DATETIME NULL AFTER refund_requested_at;

UPDATE transactions
SET refunded_at = COALESCE(refund_requested_at, created_at)
WHERE status = 'refunded'
  AND refunded_at IS NULL;
