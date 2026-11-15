-- Admins can show or hide the profile overlay button for every member.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

INSERT INTO public.app_settings (key, value)
VALUES ('overlay_button', 'true')
ON CONFLICT (key) DO NOTHING;
