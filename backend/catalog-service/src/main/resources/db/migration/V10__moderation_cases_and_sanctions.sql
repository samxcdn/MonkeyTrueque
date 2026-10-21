ALTER TABLE reports
  MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'open',
  ADD COLUMN target_type VARCHAR(24) NOT NULL DEFAULT 'listing',
  ADD COLUMN target_id VARCHAR(100) NULL,
  ADD COLUMN priority VARCHAR(16) NOT NULL DEFAULT 'normal',
  ADD COLUMN assigned_to VARCHAR(100) NULL,
  ADD COLUMN evidence_snapshot LONGTEXT NULL,
  ADD COLUMN user_response VARCHAR(1000) NULL;

UPDATE reports SET target_id = listing_id WHERE target_id IS NULL AND listing_id IS NOT NULL;
UPDATE reports SET target_type = 'user' WHERE listing_id IS NULL;

CREATE TABLE moderation_case_notes (
  id VARCHAR(36) PRIMARY KEY,
  report_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(100) NOT NULL,
  note VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_case_notes_report_created (report_id, created_at),
  CONSTRAINT fk_case_notes_report FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE moderation_case_events (
  id VARCHAR(36) PRIMARY KEY,
  report_id VARCHAR(36) NOT NULL,
  actor_id VARCHAR(100) NOT NULL,
  action VARCHAR(40) NOT NULL,
  previous_value VARCHAR(100) NULL,
  new_value VARCHAR(100) NULL,
  reason VARCHAR(1000) NOT NULL DEFAULT '',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_case_events_report_created (report_id, created_at),
  CONSTRAINT fk_case_events_report FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE moderation_sanctions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  restriction_type VARCHAR(24) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  starts_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at TIMESTAMP(6) NULL,
  created_by VARCHAR(100) NOT NULL,
  revoked_at TIMESTAMP(6) NULL,
  revoked_by VARCHAR(100) NULL,
  INDEX idx_sanctions_user_expiry (user_id, expires_at, revoked_at)
);

CREATE TABLE moderation_appeals (
  id VARCHAR(36) PRIMARY KEY,
  sanction_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  explanation VARCHAR(2000) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  reviewed_by VARCHAR(100) NULL,
  resolution VARCHAR(1000) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  reviewed_at TIMESTAMP(6) NULL,
  INDEX idx_appeals_status_created (status, created_at),
  CONSTRAINT fk_appeal_sanction FOREIGN KEY (sanction_id) REFERENCES moderation_sanctions(id)
);
