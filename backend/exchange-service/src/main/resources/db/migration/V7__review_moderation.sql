ALTER TABLE exchanges
  ADD COLUMN owner_review_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN proposer_review_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN owner_review_moderation_note VARCHAR(1000) NULL,
  ADD COLUMN proposer_review_moderation_note VARCHAR(1000) NULL;

CREATE TABLE exchange_moderation_actions (
  id VARCHAR(36) PRIMARY KEY,
  staff_id VARCHAR(100) NOT NULL,
  action VARCHAR(40) NOT NULL,
  exchange_id VARCHAR(36) NOT NULL,
  participant VARCHAR(16) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_exchange_moderation_created (created_at)
);
