CREATE TABLE moderation_staff (
  user_id VARCHAR(100) PRIMARY KEY,
  role VARCHAR(16) NOT NULL,
  added_by VARCHAR(100) NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT chk_moderation_staff_role CHECK (role IN ('admin', 'moderator'))
);
