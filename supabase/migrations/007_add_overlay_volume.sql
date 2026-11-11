-- Video sound for the profile overlay: the owner sets how loud the clip plays
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Works on its own, and also upgrades a database that already ran 006.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_image_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_video_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_media TEXT DEFAULT 'off';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_opacity INTEGER DEFAULT 25;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_volume INTEGER DEFAULT 60;

-- The volume makes a new argument list, so the older function is replaced
DROP FUNCTION IF EXISTS public.set_profile_overlay(BIGINT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.set_profile_overlay(
  p_user_id BIGINT,
  p_overlay_image_url TEXT,
  p_overlay_video_url TEXT,
  p_overlay_media TEXT,
  p_overlay_opacity INTEGER,
  p_overlay_volume INTEGER
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET overlay_image_url = p_overlay_image_url,
         overlay_video_url = p_overlay_video_url,
         overlay_media = CASE WHEN p_overlay_media IN ('image', 'video') THEN p_overlay_media ELSE 'off' END,
         overlay_opacity = GREATEST(5, LEAST(80, COALESCE(p_overlay_opacity, 25))),
         overlay_volume = GREATEST(0, LEAST(100, COALESCE(p_overlay_volume, 60)))
   WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_overlay(BIGINT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
