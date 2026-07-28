-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS ats_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  resume_id   UUID,
  name        TEXT,
  email       TEXT,
  ats_score   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- If the table already existed from a previous experiment, ensure it has the new columns
-- (Note: The 'email' here is the CANDIDATE's email from their parsed resume, NOT the auth.users email. 
-- We use this to track if the same candidate uploads multiple resume versions over time).
ALTER TABLE ats_history ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE ats_history ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS ats_history_user_id_created_idx 
  ON ats_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ats_history_email_idx 
  ON ats_history (email, created_at DESC);
