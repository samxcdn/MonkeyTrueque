CREATE TABLE blocked_users (
  id VARCHAR(36) PRIMARY KEY,
  blocker_id VARCHAR(100) NOT NULL,
  blocked_user_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_blocked_users_pair UNIQUE (blocker_id, blocked_user_id),
  INDEX idx_blocked_users_blocker (blocker_id)
);
