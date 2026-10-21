ALTER TABLE user_profiles
  ADD COLUMN email_address VARCHAR(254) NULL AFTER display_name,
  ADD COLUMN phone_number VARCHAR(40) NULL AFTER email_address,
  ADD COLUMN department VARCHAR(100) NULL AFTER phone_number,
  ADD COLUMN designation VARCHAR(100) NULL AFTER department;
