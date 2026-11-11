-- Admin controls: profile media approval, member status, roles and app settings
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ---------- New member columns ----------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- A picture or video chosen by a member waits here until an admin approves it
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_pending_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cover_pending_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_review_status TEXT DEFAULT 'none';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cover_review_status TEXT DEFAULT 'none';

-- ---------- App settings ----------

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings
  FOR SELECT USING (true);

INSERT INTO public.app_settings (key, value)
VALUES ('require_media_approval', 'true')
ON CONFLICT (key) DO NOTHING;

-- ---------- Helpers ----------

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE id = p_user_id
       AND role = 'admin'
       AND COALESCE(status, 'active') NOT IN ('deleted', 'suspended')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(BIGINT) TO anon, authenticated;

-- ---------- Bootstrap: the first admin can be claimed when none exists ----------

DROP FUNCTION IF EXISTS public.admin_claim(BIGINT);
CREATE OR REPLACE FUNCTION public.admin_claim(p_user_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users
     WHERE role = 'admin' AND COALESCE(status, 'active') NOT IN ('deleted', 'suspended')
  ) THEN
    RAISE EXCEPTION 'An admin already exists';
  END IF;
  UPDATE public.users SET role = 'admin' WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_claim(BIGINT) TO anon, authenticated;

-- ---------- Profile media: always goes through approval ----------

DROP FUNCTION IF EXISTS public.set_profile_media(BIGINT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.set_profile_media(
  p_user_id BIGINT,
  p_avatar_url TEXT,
  p_cover_url TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval BOOLEAN;
BEGIN
  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'require_media_approval'), 'true') = 'true'
    INTO v_approval;

  IF v_approval THEN
    UPDATE public.users
       SET avatar_pending_url = CASE
             WHEN p_avatar_url IS NOT NULL AND p_avatar_url IS DISTINCT FROM avatar_url
               THEN p_avatar_url ELSE avatar_pending_url END,
           avatar_review_status = CASE
             WHEN p_avatar_url IS NOT NULL AND p_avatar_url IS DISTINCT FROM avatar_url
               THEN 'pending' ELSE avatar_review_status END,
           cover_pending_url = CASE
             WHEN p_cover_url IS NOT NULL AND p_cover_url IS DISTINCT FROM cover_url
               THEN p_cover_url ELSE cover_pending_url END,
           cover_review_status = CASE
             WHEN p_cover_url IS NOT NULL AND p_cover_url IS DISTINCT FROM cover_url
               THEN 'pending' ELSE cover_review_status END
     WHERE id = p_user_id;
  ELSE
    UPDATE public.users
       SET avatar_url = COALESCE(p_avatar_url, avatar_url),
           cover_url = COALESCE(p_cover_url, cover_url),
           avatar_pending_url = NULL,
           cover_pending_url = NULL,
           avatar_review_status = 'approved',
           cover_review_status = 'approved'
     WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_media(BIGINT, TEXT, TEXT) TO anon, authenticated;

-- Submit one kind of media at a time (avatar or cover)
CREATE OR REPLACE FUNCTION public.submit_profile_media(
  p_user_id BIGINT,
  p_kind TEXT,
  p_url TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval BOOLEAN;
BEGIN
  IF p_kind NOT IN ('avatar', 'cover') THEN
    RAISE EXCEPTION 'Unknown media kind';
  END IF;

  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key = 'require_media_approval'), 'true') = 'true'
    INTO v_approval;

  IF p_kind = 'avatar' THEN
    IF v_approval THEN
      UPDATE public.users
         SET avatar_pending_url = p_url, avatar_review_status = 'pending'
       WHERE id = p_user_id;
    ELSE
      UPDATE public.users
         SET avatar_url = p_url, avatar_pending_url = NULL, avatar_review_status = 'approved'
       WHERE id = p_user_id;
    END IF;
  ELSE
    IF v_approval THEN
      UPDATE public.users
         SET cover_pending_url = p_url, cover_review_status = 'pending'
       WHERE id = p_user_id;
    ELSE
      UPDATE public.users
         SET cover_url = p_url, cover_pending_url = NULL, cover_review_status = 'approved'
       WHERE id = p_user_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_profile_media(BIGINT, TEXT, TEXT) TO anon, authenticated;

-- ---------- Admin actions ----------

CREATE OR REPLACE FUNCTION public.review_profile_media(
  p_admin_id BIGINT,
  p_user_id BIGINT,
  p_kind TEXT,
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
  IF p_kind NOT IN ('avatar', 'cover') THEN
    RAISE EXCEPTION 'Unknown media kind';
  END IF;

  IF p_kind = 'avatar' THEN
    IF p_approve THEN
      UPDATE public.users
         SET avatar_url = COALESCE(avatar_pending_url, avatar_url),
             avatar_pending_url = NULL,
             avatar_review_status = 'approved'
       WHERE id = p_user_id;
    ELSE
      UPDATE public.users
         SET avatar_pending_url = NULL,
             avatar_review_status = 'rejected'
       WHERE id = p_user_id;
    END IF;
  ELSE
    IF p_approve THEN
      UPDATE public.users
         SET cover_url = COALESCE(cover_pending_url, cover_url),
             cover_pending_url = NULL,
             cover_review_status = 'approved'
       WHERE id = p_user_id;
    ELSE
      UPDATE public.users
         SET cover_pending_url = NULL,
             cover_review_status = 'rejected'
       WHERE id = p_user_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_profile_media(BIGINT, BIGINT, TEXT, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_admin_id BIGINT,
  p_user_id BIGINT,
  p_role TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Unknown role';
  END IF;
  UPDATE public.users SET role = p_role WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(BIGINT, BIGINT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_admin_id BIGINT,
  p_user_id BIGINT,
  p_status TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;
  UPDATE public.users SET status = p_status WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_status(BIGINT, BIGINT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(
  p_admin_id BIGINT,
  p_user_id BIGINT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_admin_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;
  UPDATE public.users
     SET status = 'deleted', deleted_at = now()
   WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_soft_delete_user(BIGINT, BIGINT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_restore_user(
  p_admin_id BIGINT,
  p_user_id BIGINT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.users
     SET status = 'active', deleted_at = NULL
   WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_restore_user(BIGINT, BIGINT) TO anon, authenticated;

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
  IF p_key <> 'require_media_approval' THEN
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

-- ---------- Announcements can be removed by an admin ----------

DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;
CREATE POLICY "announcements_delete" ON public.announcements
  FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Once this migration is in place, make your own account the first admin either
-- with the button shown on #/Admin (when no admin exists yet) or with:
--   UPDATE public.users SET role = 'admin' WHERE username = 'your-username';
