# Supabase setup

The app talks to Supabase directly from the browser using the anon key served at `/config.js`.

## Credentials
- Sandbox/preview: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are app secrets (Dashboard > Secrets) and are read by `server.py` when it serves `/config.js`.
- Vercel: set the same two variables in Project Settings > Environment Variables (`api/config.js` serves them).

## Tables
Run each file in `migrations/` once in the Supabase dashboard (SQL Editor > New query):

1. `001_create_chat_messages.sql` — direct messages
2. `002_create_users.sql` — accounts used by the username/password login
3. `003_create_announcements.sql` — feed posts
4. `004_create_stories.sql` — My Day photo stories
5. `005_add_profile_media.sql` — profile picture + cover photo/video (and the `set_profile_media` write function)
6. `006_add_profile_overlay.sql` — see-through image/video that floats in front of the profile page (and the `set_profile_overlay` write function)

The app stays connected but featureless (no login, no posts, no chat) until these tables exist.
