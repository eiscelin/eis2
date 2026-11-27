-- How often each ad runs, and how long it waits before it runs again.
-- play_limit  1 = plays once, 2..N = plays that many times per visitor session,
--             0 = no limit.
-- gap_minutes 0 = may play again straight away; otherwise the same ad waits
--             this many minutes before it runs again.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS play_limit INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS gap_minutes INTEGER NOT NULL DEFAULT 0;
