CREATE TABLE consent_config_versions (
  site_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (site_id, revision),
  CHECK (json_extract(config_json, '$.siteId') = site_id),
  CHECK (json_extract(config_json, '$.revision') = revision)
);
