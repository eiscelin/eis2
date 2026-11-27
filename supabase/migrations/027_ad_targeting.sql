-- Where each ad plays: every member video, one member's videos, or one video.
-- An ad with no target plays inside every member's uploaded video. An ad with
-- target_user_id plays only in that member's videos. An ad with target_post_id
-- plays only in that one uploaded video.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS target_user_id BIGINT;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS target_post_id BIGINT;
ALTER TABLE public.ads ADD COLUMN IF NOT EXISTS target_label TEXT;

CREATE INDEX IF NOT EXISTS idx_ads_target ON public.ads(target_user_id, target_post_id);
