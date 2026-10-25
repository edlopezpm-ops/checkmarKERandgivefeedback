-- Hosted adapter: additive, private single-owner storage and admission controls.
ALTER TABLE marker_studio_meta ADD COLUMN write_token TEXT;
ALTER TABLE marker_studio_uploads ADD COLUMN lock_token TEXT;
ALTER TABLE marker_studio_uploads ADD COLUMN lock_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marker_studio_jobs ADD COLUMN lock_token TEXT;
ALTER TABLE marker_studio_jobs ADD COLUMN lock_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marker_studio_jobs ADD COLUMN reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0);
CREATE UNIQUE INDEX marker_studio_one_upload ON marker_studio_uploads(status) WHERE status='uploading';
CREATE UNIQUE INDEX marker_studio_one_render ON marker_studio_jobs((1)) WHERE status IN ('queued','running');
CREATE TABLE marker_studio_limits (
  id INTEGER PRIMARY KEY CHECK(id=1),
  stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK(stored_bytes>=0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  upload_token TEXT,
  compute_token TEXT,
  compute_until INTEGER NOT NULL DEFAULT 0
);
INSERT INTO marker_studio_limits(id) VALUES(1);
CREATE TABLE marker_studio_compute (
  month TEXT PRIMARY KEY CHECK(length(month)=7),
  used_cents INTEGER NOT NULL DEFAULT 0 CHECK(used_cents>=0),
  last_token TEXT
);
