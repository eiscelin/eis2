-- How long an image ad stays on screen, set per ad by the admin.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS image_seconds INTEGER NOT NULL DEFAULT 6;

-- Image ads saved before this column existed kept their seconds in skip_seconds
UPDATE public.ads
   SET image_seconds = skip_seconds
 WHERE media_type LIKE '%image%'
   AND skip_seconds > 0
   AND skip_seconds <> 5;
