CREATE TABLE rate_limit_windows (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE INDEX idx_rate_limit_expiry ON rate_limit_windows(expires_at);
