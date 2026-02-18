-- HTTP logs table
CREATE TABLE IF NOT EXISTS http_logs (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  domain TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms INTEGER,
  request_headers TEXT,
  response_headers TEXT,
  body_size INTEGER
);

-- Indexes for faceted search
CREATE INDEX IF NOT EXISTS idx_logs_method ON http_logs(method);
CREATE INDEX IF NOT EXISTS idx_logs_status ON http_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_logs_domain ON http_logs(domain);
CREATE INDEX IF NOT EXISTS idx_logs_path ON http_logs(path);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON http_logs(timestamp DESC);
