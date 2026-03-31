-- Supabase Migration Script for Resume Ranking System
-- Run this in your Supabase SQL Editor

-- Companies Table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    cpi DOUBLE PRECISION DEFAULT 0.0,
    skill_set TEXT[] DEFAULT '{}',
    internship_role TEXT,
    visits_iit_patna BOOLEAN DEFAULT FALSE,
    min_projects INTEGER DEFAULT 0,
    project_keywords TEXT[] DEFAULT '{}',
    branch TEXT[] DEFAULT '{}',
    dsa_required BOOLEAN DEFAULT FALSE,
    core_skills TEXT[] DEFAULT '{}',
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Resumes Table
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    education JSONB DEFAULT '[]'::jsonb,
    skills TEXT[] DEFAULT '{}',
    experience JSONB DEFAULT '[]'::jsonb,
    projects JSONB DEFAULT '[]'::jsonb,
    rankings JSONB DEFAULT '[]'::jsonb,
    resume_text TEXT NOT NULL,
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: In Supabase, you might want to enable Row Level Security (RLS) policies 
-- depending on your authentication layer. For now, since the backend uses the Service Role Key, 
-- it will bypass RLS.
