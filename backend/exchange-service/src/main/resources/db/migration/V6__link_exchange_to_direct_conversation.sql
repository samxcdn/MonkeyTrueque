ALTER TABLE exchanges
  ADD COLUMN conversation_id VARCHAR(36) NULL,
  ADD UNIQUE INDEX idx_exchanges_conversation (conversation_id);
