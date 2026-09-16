-- The `skills` column on `resumes` was created as text[] instead of jsonb.
-- resume_parser.py writes skills as a list of dicts ({"name","confidence","sources"}),
-- so the Supabase client silently serializes each dict to its JSON string
-- representation and stores it as a plain text array element. Every read then
-- returns skills as a list of JSON *strings* instead of objects, which fails
-- Pydantic response validation on GET /resumes/{id} (response_model=ResumeInDB
-- declares skills: List[Dict[str, Any]]) with a 500 error.
--
-- Converts existing rows in place: each text element is parsed back into jsonb
-- and re-aggregated into a jsonb array. NULL/empty arrays become '[]'::jsonb.
ALTER TABLE resumes
  ALTER COLUMN skills TYPE jsonb
  USING (
    COALESCE(
      (SELECT jsonb_agg(elem::jsonb) FROM unnest(skills) AS elem),
      '[]'::jsonb
    )
  );

ALTER TABLE resumes ALTER COLUMN skills SET DEFAULT '[]'::jsonb;
