-- Two more admin switches: uploaded cover videos and video posts.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- Both features start switched on
INSERT INTO public.app_settings (key, value)
VALUES ('cover_video', 'true'), ('video_posts', 'true')
ON CONFLICT (key) DO NOTHING;

-- The admin setting writer accepts these keys too
CREATE OR REPLACE FUNCTION public.admin_set_setting(
  p_admin_id BIGINT,
  p_key TEXT,
  p_value TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_key NOT IN ('require_media_approval', 'overlay_button', 'cover_video', 'video_posts') THEN
    RAISE EXCEPTION 'Unknown setting';
  END IF;
  IF p_value NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'Setting must be true or false';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_setting(BIGINT, TEXT, TEXT) TO anon, authenticated;
