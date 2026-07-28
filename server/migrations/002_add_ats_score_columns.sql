-- ATS score/feedback/breakdown were computed on every upload but never persisted —
-- only returned transiently in the job-status payload, then lost forever once the
-- job row aged out. This adds columns so the resume result page can show them.

alter table resumes add column if not exists ats_score integer;
alter table resumes add column if not exists ats_feedback jsonb default '[]'::jsonb;
alter table resumes add column if not exists ats_breakdown jsonb default '{}'::jsonb;
