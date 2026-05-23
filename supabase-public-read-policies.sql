-- PhysioPipeline public browsing speed setup
-- Run this in the Supabase SQL editor when Vercel pages should read public
-- profile cards directly from Supabase without waiting for Render.
--
-- The frontend first tries public.public_profiles, then public."Profile",
-- and finally falls back to Render if Supabase blocks the request.

create or replace view public.public_profiles as
select
  id,
  name,
  specialty,
  "secondarySpecialty",
  city,
  neighborhood,
  phone,
  bio,
  instagram,
  linkedin,
  "photoUrl",
  attendance,
  "isClaimed",
  "createdAt",
  "updatedAt"
from public."Profile";

grant usage on schema public to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

-- Keep direct table reads private if you expose the view above.
-- This helps avoid accidentally exposing private columns like publicEmail.
revoke select on public."Profile" from anon;

-- Current schema note:
-- Profile.ownerUserId points to public."User".id, not Supabase Auth auth.uid().
-- Do not enable direct frontend profile create/update until a Supabase ownership
-- column or mapping table exists. A future safe policy could look like this:
--
-- alter table public."Profile" add column if not exists "supabaseUserId" uuid;
-- alter table public."Profile" enable row level security;
-- create policy "Users can read their own profile"
-- on public."Profile"
-- for select
-- to authenticated
-- using ("supabaseUserId" = auth.uid());
--
-- create policy "Users can update their own profile"
-- on public."Profile"
-- for update
-- to authenticated
-- using ("supabaseUserId" = auth.uid())
-- with check ("supabaseUserId" = auth.uid());
