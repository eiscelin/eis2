-- Photo and video gallery on the member home page, with a privacy lock.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS gallery_locked BOOLEAN NOT NULL DEFAULT false;
