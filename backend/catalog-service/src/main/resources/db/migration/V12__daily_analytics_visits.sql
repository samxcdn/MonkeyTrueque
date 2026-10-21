CREATE TABLE analytics_daily_visits (
  visit_date DATE NOT NULL,
  browser VARCHAR(20) NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  page_key VARCHAR(32) NOT NULL,
  visit_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (visit_date, browser, source_type, page_key),
  INDEX idx_analytics_daily_visits_date (visit_date)
);
