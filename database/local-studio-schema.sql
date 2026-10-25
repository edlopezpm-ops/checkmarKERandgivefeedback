-- Schema only, reconstructed in an empty in-memory SQLite database. No data or INSERT statements.
PRAGMA foreign_keys=ON;

CREATE TABLE studio_analysis(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES studio_assets(id),sha256 TEXT NOT NULL,start_ms INTEGER NOT NULL,end_ms INTEGER NOT NULL,profile TEXT NOT NULL,tool_version TEXT NOT NULL,status TEXT NOT NULL,document TEXT NOT NULL,reserved_bytes INTEGER NOT NULL DEFAULT 0,metadata_reserved INTEGER NOT NULL DEFAULT 0);

CREATE TABLE studio_asset_files(asset_id TEXT PRIMARY KEY REFERENCES studio_assets(id),storage_key TEXT NOT NULL UNIQUE);

CREATE TABLE studio_assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL,document TEXT NOT NULL);

CREATE TABLE studio_campaigns(id TEXT PRIMARY KEY,document TEXT NOT NULL);

CREATE TABLE studio_jobs(id TEXT PRIMARY KEY,variant_id TEXT NOT NULL,recipe_revision INTEGER NOT NULL,document TEXT NOT NULL);

CREATE TABLE studio_materials(id TEXT PRIMARY KEY,document TEXT NOT NULL);

CREATE TABLE studio_meta(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);

CREATE TABLE studio_settings(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL CHECK(json_valid(document)));

CREATE TABLE studio_uploads(id TEXT PRIMARY KEY,document TEXT NOT NULL);

CREATE TABLE studio_variants(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,document TEXT NOT NULL);

CREATE UNIQUE INDEX studio_analysis_cache ON studio_analysis(sha256,start_ms,end_ms,profile,tool_version) WHERE status!='failed';

CREATE INDEX studio_assets_hash ON studio_assets(sha256);

CREATE INDEX studio_jobs_recipe ON studio_jobs(variant_id,recipe_revision);
