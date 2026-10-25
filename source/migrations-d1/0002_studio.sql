-- PREPARED ONLY. Not applied by the local studio and not a hosted-media release.
-- Each entity is a separate row: originals and derivatives belong in private
-- object storage, never marker_workspace or a single JSON document.
-- The authenticated owner boundary must wrap every later hosted studio route.
CREATE TABLE IF NOT EXISTS marker_studio_meta (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL CHECK(revision>=0)
);
INSERT OR IGNORE INTO marker_studio_meta VALUES(1,0);
CREATE TABLE IF NOT EXISTS marker_studio_assets (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  kind TEXT NOT NULL CHECK(kind IN ('video','image','audio')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 262144000),
  storage_key TEXT NOT NULL UNIQUE,
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE INDEX IF NOT EXISTS marker_studio_assets_hash ON marker_studio_assets(sha256);
CREATE TABLE IF NOT EXISTS marker_studio_materials (
  id TEXT PRIMARY KEY,
  asset_id TEXT REFERENCES marker_studio_assets(id) ON DELETE RESTRICT,
  content_version INTEGER NOT NULL CHECK(content_version>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE IF NOT EXISTS marker_studio_campaigns (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE IF NOT EXISTS marker_studio_variants (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marker_studio_campaigns(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE INDEX IF NOT EXISTS marker_studio_variants_campaign ON marker_studio_variants(campaign_id);
CREATE TABLE IF NOT EXISTS marker_studio_uploads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('uploading','completed','cancelled')),
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE TABLE IF NOT EXISTS marker_studio_jobs (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES marker_studio_variants(id) ON DELETE RESTRICT,
  recipe_revision INTEGER NOT NULL CHECK(recipe_revision>0),
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  document TEXT NOT NULL CHECK(json_valid(document))
);
CREATE INDEX IF NOT EXISTS marker_studio_jobs_recipe ON marker_studio_jobs(variant_id,recipe_revision);
