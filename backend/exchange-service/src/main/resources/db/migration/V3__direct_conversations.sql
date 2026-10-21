CREATE TABLE conversations (
  id VARCHAR(36) PRIMARY KEY,
  listing_id VARCHAR(36) NOT NULL,
  listing_title VARCHAR(120) NOT NULL,
  listing_mode VARCHAR(16) NOT NULL,
  listing_price DECIMAL(10,2) NULL,
  listing_photo_url VARCHAR(1200) NULL,
  owner_id VARCHAR(100) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  owner_image_url VARCHAR(1000) NULL,
  visitor_id VARCHAR(100) NOT NULL,
  visitor_name VARCHAR(120) NOT NULL,
  visitor_image_url VARCHAR(1000) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_conversation_listing_visitor UNIQUE (listing_id, visitor_id),
  INDEX idx_conversations_owner_updated (owner_id, updated_at),
  INDEX idx_conversations_visitor_updated (visitor_id, updated_at)
);

CREATE TABLE direct_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(100) NOT NULL,
  body VARCHAR(400) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_direct_messages_conversation_created (conversation_id, created_at),
  CONSTRAINT fk_direct_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
