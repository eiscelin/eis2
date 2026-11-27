-- Advertisements shown inside member videos.
-- The admin uploads an ad image or video, reviews it in Admin > Ads, and an
-- approved ad plays as an ad break inside a member's video (YouTube style):
-- the member's video pauses while the ad runs, then continues where it stopped.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS public.ads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',   -- image | video
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
  is_active BOOLEAN NOT NULL DEFAULT true,    -- approved and switched on = plays
  skip_seconds INTEGER NOT NULL DEFAULT 5,    -- how long until the Skip button appears
  created_by BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ads_select" ON public.ads;
CREATE POLICY "ads_select" ON public.ads FOR SELECT USING (true);
DROP POLICY IF EXISTS "ads_insert" ON public.ads;
CREATE POLICY "ads_insert" ON public.ads FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "ads_update" ON public.ads;
CREATE POLICY "ads_update" ON public.ads FOR UPDATE USING (true);
DROP POLICY IF EXISTS "ads_delete" ON public.ads;
CREATE POLICY "ads_delete" ON public.ads FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_ads_created ON public.ads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads(status, is_active);

-- Ad breaks inside member videos start switched on
INSERT INTO public.app_settings (key, value)
VALUES ('video_ads', 'true')
ON CONFLICT (key) DO NOTHING;

-- The admin setting writer accepts the video_ads switch too
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
  IF p_key NOT IN ('require_media_approval', 'overlay_button', 'cover_video', 'video_posts', 'guest_chat_send', 'video_ads') THEN
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

-- ---------- Admin actions ----------

-- Approve or reject an uploaded ad
CREATE OR REPLACE FUNCTION public.admin_review_ad(
  p_admin_id BIGINT,
  p_ad_id BIGINT,
  p_approve BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.ads
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         updated_at = now()
   WHERE id = p_ad_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_ad(BIGINT, BIGINT, BOOLEAN) TO anon, authenticated;

-- Switch an approved ad in or out of the rotation
CREATE OR REPLACE FUNCTION public.admin_set_ad_active(
  p_admin_id BIGINT,
  p_ad_id BIGINT,
  p_active BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.ads
     SET is_active = p_active,
         updated_at = now()
   WHERE id = p_ad_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_ad_active(BIGINT, BIGINT, BOOLEAN) TO anon, authenticated;

-- The home feed and the ad player read only the ads that may play
CREATE INDEX IF NOT EXISTS idx_ads_rotation ON public.ads(status, is_active, created_at);
