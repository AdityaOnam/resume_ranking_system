-- Adds the candidate's original uploaded filename so the frontend can show
-- real filenames (e.g. "Aditya_Resume_v2.pdf") in upload history instead of
-- synthesized "vN" labels. Previously only a generated uploads/<uuid>.ext
-- file_path was stored, which isn't fit for display.
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE ats_history ADD COLUMN IF NOT EXISTS original_filename TEXT;
