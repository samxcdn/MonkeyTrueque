CREATE TABLE moderation_evidence_attachments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  owner_type VARCHAR(16) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(160) NOT NULL,
  media_type VARCHAR(20) NOT NULL,
  content LONGBLOB NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_moderation_evidence_owner (owner_type, owner_id, created_at),
  CONSTRAINT chk_moderation_evidence_owner_type CHECK (owner_type IN ('report', 'appeal')),
  CONSTRAINT chk_moderation_evidence_media_type CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp'))
);
