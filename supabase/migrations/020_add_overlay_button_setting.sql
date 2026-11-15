-- Admins can show or hide the profile overlay button for every member.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- The overlay button starts visible
INSERT INTO public.app_settings (key, value)
VALUES ('overlay_button', 'true')
ON CONFLICT (key) DO NOTHING;

-- The admin setting writer used to accept one key only; let it save this one too
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
  IF p_key NOT IN ('require_media_approval', 'overlay_button') THEN
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
