CREATE TABLE exchange_event_inbox (
  event_key VARCHAR(100) PRIMARY KEY,
  exchange_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  received_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_exchange_event_inbox_exchange (exchange_id)
);
