-- Google Drive connection for the Vercel deployment ------------------------
-- The serverless functions save the refresh token here with the service role
-- key. RLS is on with no policies, so the anon key used by the browser can
-- neither read nor write this table.

CREATE TABLE IF NOT EXISTS public.storage_connections (
  provider TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  email TEXT,
  connected_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.storage_connections ENABLE ROW LEVEL SECURITY;
