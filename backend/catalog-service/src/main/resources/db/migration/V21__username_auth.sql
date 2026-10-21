ALTER TABLE app_users
  ADD COLUMN username VARCHAR(40) NULL AFTER user_id;

UPDATE app_users
SET username = CONCAT('usuario_', REPLACE(user_id, '-', ''));

ALTER TABLE app_users
  MODIFY COLUMN username VARCHAR(40) NOT NULL,
  ADD UNIQUE KEY uk_app_users_username (username),
  DROP COLUMN email_address;
