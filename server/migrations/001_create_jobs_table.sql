-- Persists resume-upload background job status so it survives server restarts
-- and works across multiple uvicorn workers (previously an in-memory dict in
-- server/app/api/endpoints/resumes.py).
--
-- Run this once against your Supabase project (SQL Editor or `supabase db push`).

create table if not exists jobs (
    id text primary key,
    status text not null default 'processing',
    step text,
    error text,
    resume_id text,
    resume jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists jobs_created_at_idx on jobs (created_at);
