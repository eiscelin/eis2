-- My Profile details + password change
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;

-- Members (and the admin in their My Profile tab) save their own details here
DROP FUNCTION IF EXISTS public.set_profile_details(BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.set_profile_details(
  p_user_id BIGINT,
  p_full_name TEXT,
  p_age INTEGER,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_age IS NOT NULL AND (p_age < 1 OR p_age > 120) THEN
    RAISE EXCEPTION 'Enter an age between 1 and 120';
  END IF;

  UPDATE public.users
     SET full_name = NULLIF(btrim(COALESCE(p_full_name, '')), ''),
         age = p_age,
         email = NULLIF(btrim(COALESCE(p_email, '')), ''),
         phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
         address = NULLIF(btrim(COALESCE(p_address, '')), '')
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_profile_details(BIGINT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Password change for the account that owns the profile
DROP FUNCTION IF EXISTS public.set_user_password(BIGINT, TEXT);
CREATE OR REPLACE FUNCTION public.set_user_password(
  p_user_id BIGINT,
  p_password TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(COALESCE(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE public.users SET password = p_password WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_password(BIGINT, TEXT) TO anon, authenticated;
