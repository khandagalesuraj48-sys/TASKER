-- Migration: create app_releases table for in‑app Android updates
-- Do NOT modify any existing tables or data. This migration only adds a new table.

create extension if not exists "uuid-ossp"; -- ensure uuid_generate_v4 is available

create table public.app_releases (
    id uuid primary key default uuid_generate_v4(),
    version_name text not null,          -- e.g. '1.0.1'
    version_code integer not null,       -- Android versionCode for comparison
    release_notes text,                  -- Markdown or plain text release notes
    apk_url text not null,               -- Direct URL to the APK asset (GitHub release)
    release_url text,                    -- Alias for backwards compatibility
    is_mandatory boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure each version_code is unique
create unique index app_releases_version_code_idx on public.app_releases (version_code);

-- RLS: allow anonymous read access (public) – safe because data is public metadata only
alter table public.app_releases enable row level security;
-- Policy to allow all SELECT (including from anon role)
create policy "public select" on public.app_releases for select to public using (true);

-- No INSERT/UPDATE/DELETE policies are required – they will be performed by admin via Supabase dashboard.

