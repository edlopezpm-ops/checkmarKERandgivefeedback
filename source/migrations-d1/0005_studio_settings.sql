-- Owner settings preserve existing usage, objects and immutable receipts.
-- Internal budgets do not cap the provider invoice or enable AI execution.
CREATE TABLE marker_studio_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  monthly_budget_cents INTEGER NOT NULL DEFAULT 2000 CHECK(monthly_budget_cents BETWEEN 0 AND 2000),
  processing_budget_cents INTEGER NOT NULL DEFAULT 1000 CHECK(processing_budget_cents BETWEEN 0 AND 2000),
  ai_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK(ai_budget_cents BETWEEN 0 AND 2000),
  storage_limit_bytes INTEGER NOT NULL DEFAULT 2147483648 CHECK(storage_limit_bytes BETWEEN 0 AND 2147483648),
  default_duration_seconds INTEGER NOT NULL DEFAULT 20 CHECK(default_duration_seconds BETWEEN 5 AND 60),
  CHECK(processing_budget_cents+ai_budget_cents<=monthly_budget_cents)
);
INSERT INTO marker_studio_settings(id) VALUES(1);
