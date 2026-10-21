CREATE TABLE exchanges (
  id VARCHAR(36) PRIMARY KEY,
  listing_id VARCHAR(36) NOT NULL,
  listing_title VARCHAR(120) NOT NULL,
  owner_id VARCHAR(100) NOT NULL,
  proposer_id VARCHAR(100) NOT NULL,
  offered_title VARCHAR(120) NOT NULL,
  offered_kind VARCHAR(20) NOT NULL,
  note VARCHAR(1000) NOT NULL,
  status VARCHAR(30) NOT NULL,
  meetup_place VARCHAR(250) NOT NULL DEFAULT '',
  meetup_date VARCHAR(20) NOT NULL DEFAULT '',
  meetup_time VARCHAR(20) NOT NULL DEFAULT '',
  owner_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  proposer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  owner_rating INT NULL,
  owner_review VARCHAR(1000) NULL,
  proposer_rating INT NULL,
  proposer_review VARCHAR(1000) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_exchanges_owner_created (owner_id, created_at),
  INDEX idx_exchanges_proposer_created (proposer_id, created_at),
  INDEX idx_exchanges_listing (listing_id)
);

CREATE TABLE exchange_messages (
  id VARCHAR(36) PRIMARY KEY,
  exchange_id VARCHAR(36) NOT NULL,
  sender VARCHAR(10) NOT NULL,
  body VARCHAR(400) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_messages_exchange_created (exchange_id, created_at),
  CONSTRAINT fk_messages_exchange FOREIGN KEY (exchange_id) REFERENCES exchanges(id)
);
