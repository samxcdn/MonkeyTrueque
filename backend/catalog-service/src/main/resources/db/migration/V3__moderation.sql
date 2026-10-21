ALTER TABLE listings ADD COLUMN moderation_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE reports (
  id VARCHAR(36) PRIMARY KEY,
  reporter_id VARCHAR(100) NOT NULL,
  listing_id VARCHAR(36) NULL,
  reason VARCHAR(40) NOT NULL,
  details VARCHAR(1000) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution VARCHAR(1000) NULL,
  reviewed_by VARCHAR(100) NULL,
  reviewed_at TIMESTAMP(6) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_reports_status_created (status, created_at),
  INDEX idx_reports_listing (listing_id)
);

CREATE TABLE moderation_actions (
  id VARCHAR(36) PRIMARY KEY,
  admin_id VARCHAR(100) NOT NULL,
  action VARCHAR(40) NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  note VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_moderation_actions_created (created_at)
);
