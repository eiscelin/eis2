-- Contact details shown on the ad itself, like the Skip button: a mobile
-- number offers Call and Message buttons, a Facebook page opens the page.
-- contact_type   NULL = no contact details, 'mobile' or 'facebook'
-- contact_value  the number with its country code, or the Facebook page address
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS contact_type TEXT;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS contact_value TEXT;
