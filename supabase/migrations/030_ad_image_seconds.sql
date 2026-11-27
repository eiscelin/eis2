-- How long an image ad stays on screen, set per ad by the admin.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS image_seconds INTEGER NOT NULL DEFAULT 6;
