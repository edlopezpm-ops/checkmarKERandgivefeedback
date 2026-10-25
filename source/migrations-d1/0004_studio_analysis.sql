-- Prepared additive migration. Applying it and enabling a verified hosted
-- toolchain remain separate release actions; originals and old receipts stay.
CREATE TABLE marker_studio_analysis (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES marker_studio_assets(id) ON DELETE RESTRICT,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  start_ms INTEGER NOT NULL CHECK(start_ms>=0),
  end_ms INTEGER NOT NULL CHECK(end_ms>start_ms AND end_ms-start_ms<=120000),
  profile TEXT NOT NULL,
  tool_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  document TEXT NOT NULL CHECK(json_valid(document)),
  lock_token TEXT,
  lock_until INTEGER NOT NULL DEFAULT 0,
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  metadata_reserved INTEGER NOT NULL DEFAULT 0 CHECK(metadata_reserved>=0)
);
CREATE UNIQUE INDEX marker_studio_analysis_cache ON marker_studio_analysis(sha256,start_ms,end_ms,profile,tool_version) WHERE status!='failed';
CREATE INDEX marker_studio_analysis_asset ON marker_studio_analysis(asset_id);
CREATE INDEX marker_studio_analysis_status ON marker_studio_analysis(status);
