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
7. `007_add_overlay_volume.sql` — volume for the overlay video; also safe to run on its own instead of step 6
8. `008_add_admin_controls.sql` — profile media approval queue, member roles/status, message moderation and the admin panel functions
9. `009_add_profile_details.sql` — personal details (age, address, mobile) on the profile tab
10. `010_admin_delete_content.sql` — admins can remove a member's displayed content
11. `011_add_friend_requests.sql` — friend requests: "People you may know" → Add Friend → the other member confirms in the notification bell
12. `012_create_posts.sql` — member posts with photo/video, reactions and comments (comment edit/delete, comment reactions)
13. `013_add_post_sharing.sql` / `014_create_reaction_media.sql` — shared posts and uploaded face reactions
14. `015_add_page_background.sql` — account background picture that shows behind every page (and the `set_page_background` write function)
15. `017_add_gallery_privacy.sql` — remembers whether a member locked their photo and video gallery
16. `022_create_storage_connection.sql` — Google Drive connection used by the Vercel functions (service-role only, the browser cannot read it)

After running `008`, open `#/Admin` while signed in. If no admin exists yet, the panel offers
"Make me the first admin" once; otherwise set the role in SQL:

```sql
UPDATE public.users SET role = 'admin' WHERE username = 'your-username';
```

The app stays connected but featureless (no login, no posts, no chat) until these tables exist.

## Google Drive storage (Vercel)
Photos uploaded on the Vercel deployment are saved in the owner's own Google Drive; videos keep
using Cloudinary there, because a Vercel function cannot stream them back from Drive.

1. Run `022_create_storage_connection.sql` — the connected account is stored in that table.
2. In Vercel > Project Settings > Environment Variables add:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — the OAuth client from Google Cloud Console.
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase > Project Settings > API > `service_role`. Server-side only, never served to the browser.
3. In Google Cloud Console > Credentials > your OAuth client, add the redirect URI shown in
   Admin > Settings > Storage (`https://<your-domain>/oauth/google/callback`).
4. Redeploy, then Admin > Settings > Storage > Connect Google Drive.

The sandbox preview does not need the service role key: `server.py` keeps the connection in a
file on its own volume.
