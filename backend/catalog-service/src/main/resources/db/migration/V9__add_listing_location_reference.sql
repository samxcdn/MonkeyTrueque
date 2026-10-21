ALTER TABLE listings
  ADD COLUMN location_reference VARCHAR(160) NULL AFTER district_id;
