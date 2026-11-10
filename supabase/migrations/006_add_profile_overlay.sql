-- Translucent media overlay shown in front of a member's whole profile page
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_image_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_video_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_media TEXT DEFAULT 'off';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS overlay_opacity INTEGER DEFAULT 25;

-- Writes go through this function for the same reason as set_profile_media: a
-- signed-in browser may change the overlay columns only, never the password or role.
CREATE OR REPLACE FUNCTION public.set_profile_overlay(
  p_user_id BIGINT,
  p_overlay_image_url TEXT,
  p_overlay_video_url TEXT,
  p_overlay_media TEXT,
  p_overlay_opacity INTEGER
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET overlay_image_url = p_overlay_image_url,
         overlay_video_url = p_overlay_video_url,
         overlay_media = CASE WHEN p_overlay_media IN ('image', 'video') THEN p_overlay_media ELSE 'off' END,
         overlay_opacity = GREATEST(5, LEAST(80, COALESCE(p_overlay_opacity, 25)))
   WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_overlay(BIGINT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated;
