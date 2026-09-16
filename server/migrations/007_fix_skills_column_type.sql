-- The `skills` column on `resumes` was created as text[] instead of jsonb.
-- resume_parser.py writes skills as a list of dicts ({"name","confidence","sources"}),
-- so the Supabase client silently serializes each dict to its JSON string
-- representation and stores it as a plain text array element. Every read then
-- returns skills as a list of JSON *strings* instead of objects, which fails
-- Pydantic response validation on GET /resumes/{id} (response_model=ResumeInDB
-- declares skills: List[Dict[str, Any]]) with a 500 error.
--
-- Two Postgres gotchas handled here:
-- 1. ALTER COLUMN ... USING can't contain a correlated subquery ("cannot use
--    subquery in transform expression"), so the per-row text[] -> jsonb
--    conversion goes through a throwaway helper function instead.
-- 2. The column's existing text[] DEFAULT can't be auto-cast to jsonb, so it
--    must be dropped before the TYPE change and re-added after.
ALTER TABLE resumes ALTER COLUMN skills DROP DEFAULT;

CREATE OR REPLACE FUNCTION _rr_text_array_to_jsonb(arr text[]) RETURNS jsonb AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  elem text;
BEGIN
  IF arr IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  FOREACH elem IN ARRAY arr LOOP
    IF elem IS NOT NULL THEN
      result := result || jsonb_build_array(elem::jsonb);
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE resumes
  ALTER COLUMN skills TYPE jsonb
  USING _rr_text_array_to_jsonb(skills);

ALTER TABLE resumes ALTER COLUMN skills SET DEFAULT '[]'::jsonb;

DROP FUNCTION _rr_text_array_to_jsonb(text[]);
