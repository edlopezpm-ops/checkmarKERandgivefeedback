-- Necessary rights-routing reference only; preferences and events stay central.
CREATE TABLE marker_analytics_subject (
  id INTEGER PRIMARY KEY CHECK(id=1),
  subject_ref TEXT NOT NULL CHECK(length(subject_ref)=64),
  delete_receipt_id TEXT CHECK(delete_receipt_id IS NULL OR length(delete_receipt_id)<=96)
);
CREATE TRIGGER marker_analytics_subject_account_insert BEFORE INSERT ON marker_analytics_subject
WHEN COALESCE((SELECT status FROM marker_account_lifecycle WHERE id=1),'closed') != 'active'
BEGIN SELECT RAISE(ABORT,'ACCOUNT_CLOSED'); END;
