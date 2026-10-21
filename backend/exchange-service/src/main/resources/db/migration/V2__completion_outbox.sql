CREATE TABLE exchange_completion_outbox (
  exchange_id VARCHAR(36) PRIMARY KEY,
  listing_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  delivered_at TIMESTAMP(6) NULL,
  CONSTRAINT fk_completion_outbox_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id),
  INDEX idx_completion_outbox_pending (delivered_at, created_at)
);

INSERT INTO exchange_completion_outbox (exchange_id, listing_id)
SELECT id, listing_id FROM exchanges WHERE status IN ('confirmed-by-both', 'rated');
