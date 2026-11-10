-- Profile picture + cover (banner) media on accounts
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Writes go through this function so a signed-in browser can only change the two
-- media columns — never the password or role — even though users_select is public.
CREATE OR REPLACE FUNCTION public.set_profile_media(
  p_user_id BIGINT,
  p_avatar_url TEXT,
  p_cover_url TEXT
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET avatar_url = p_avatar_url,
         cover_url = p_cover_url
   WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_media(BIGINT, TEXT, TEXT) TO anon, authenticated;
