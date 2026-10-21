CREATE DATABASE IF NOT EXISTS monkey_catalog
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS monkey_exchange
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'monkeytrueque'@'localhost'
  IDENTIFIED BY 'monkeytrueque_local';

ALTER USER 'monkeytrueque'@'localhost'
  IDENTIFIED BY 'monkeytrueque_local';

GRANT ALL PRIVILEGES ON monkey_catalog.*
  TO 'monkeytrueque'@'localhost';

GRANT ALL PRIVILEGES ON monkey_exchange.*
  TO 'monkeytrueque'@'localhost';
