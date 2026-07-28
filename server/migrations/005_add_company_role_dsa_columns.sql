-- The API layer's request/response model (server/app/models/company.py) never
-- declared dsa_required, internship_role, or visits_iit_patna, so Pydantic
-- silently stripped them from every company created through POST /api/companies/
-- (and even the original seed script computed these values from the source
-- spreadsheet but never included them in its INSERT column list). This adds
-- the columns so the now-updated model can actually persist them.
--
-- Safe to run even if these columns already exist in your Supabase project.

alter table companies add column if not exists dsa_required boolean default false;
alter table companies add column if not exists internship_role text default '';
alter table companies add column if not exists visits_iit_patna boolean default false;

notify pgrst, 'reload schema';
