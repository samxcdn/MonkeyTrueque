CREATE TABLE listings (
  id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(100) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  category VARCHAR(30) NOT NULL,
  item_condition VARCHAR(80) NOT NULL,
  district_id VARCHAR(40) NOT NULL,
  acceptance_summary VARCHAR(300) NOT NULL,
  accepts VARCHAR(50) NOT NULL,
  photos_json LONGTEXT NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_listings_district_created (district_id, created_at),
  INDEX idx_listings_owner (owner_id)
);
