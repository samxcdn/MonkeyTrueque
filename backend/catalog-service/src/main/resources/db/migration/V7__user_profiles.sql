CREATE TABLE user_profiles (
  user_id VARCHAR(100) PRIMARY KEY,
  display_name VARCHAR(120) NOT NULL,
  image_url VARCHAR(1000) NULL,
  member_since TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

INSERT INTO user_profiles (user_id, display_name, image_url, member_since)
SELECT l.owner_id,
       (SELECT first_listing.owner_name FROM listings first_listing WHERE first_listing.owner_id = l.owner_id ORDER BY first_listing.created_at LIMIT 1),
       (SELECT first_listing.owner_image_url FROM listings first_listing WHERE first_listing.owner_id = l.owner_id ORDER BY first_listing.created_at LIMIT 1),
       MIN(l.created_at)
FROM listings l
GROUP BY l.owner_id;
