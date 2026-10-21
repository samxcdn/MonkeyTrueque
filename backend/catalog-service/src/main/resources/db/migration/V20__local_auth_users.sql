CREATE TABLE app_users (
  user_id VARCHAR(100) PRIMARY KEY,
  email_address VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  deactivated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_app_users_email (email_address)
);
