# Instagram scheduler — setup (2026-10-09)

The social scheduler lives at `/admin/social` (queue), `/admin/social/new` (compose),
`/admin/social/import` (bulk plan), `/admin/social/accounts` (connection). Code:
`apps/web/lib/social/*`, `apps/web/app/admin/(dashboard)/social/*`,
`apps/web/app/api/social/instagram/*`, `apps/web/app/api/cron/social-publish`.
Migration: `supabase/migrations/0071_social_scheduler.sql`.

It works **today in manual mode** with nothing configured. API publishing switches on
once the Meta app exists and @nullshift.dev is connected.

## 1. How manual mode works (no Meta app needed)

1. Write posts (or import a plan), approve them, schedule them.
2. Every 15 minutes the cron (`/api/cron/social-publish`) picks up `scheduled` posts whose
   time has passed. With no connected Instagram account it sets them to `needs_manual`
   and emails **louis@nullshift.co.uk** the caption, the first comment, the media links
   and two buttons: _Mark as published_ and _Open in admin_.
3. Post it from the Instagram app, then click _Mark as published_ (it opens the post page;
   the button there records `published`). Nothing is marked published by the email link
   itself — the click on the page does it.

The queue never publishes a draft: a post must be `approved` (by a staff click) before it
can be `scheduled`, and the cron only reads `scheduled`. Editing the caption, kind or media
of an approved/scheduled post sends it back to draft.

## 2. Meta developer steps (one-off, Louis)

Prerequisite: **@nullshift.dev must be an Instagram professional (Business) account linked
to a Facebook Page.** In the Instagram app: Settings → Account type and tools → Switch to
professional account → Business. Then Settings → Accounts Center (or "Linked accounts") →
link the Nullshift Facebook Page (create a Page named "Nullshift" first at
facebook.com/pages/create if there isn't one). Louis must be an admin of that Page.

1. Go to https://developers.facebook.com/apps → **Create app**.
   - Use case: "Other" → type **Business**. Name: `Nullshift Studio`. Contact email:
     louis@nullshift.co.uk. Business portfolio: create/select "Nullshift".
2. In the app dashboard → **Add product**:
   - **Facebook Login for Business** → Settings → _Valid OAuth Redirect URIs_:
     `https://nullshift.co.uk/api/social/instagram/callback`
     (also add `http://localhost:3000/api/social/instagram/callback` for local testing).
   - **Instagram** (Instagram Graph API / "Instagram API with Facebook Login").
3. **App settings → Basic**: copy **App ID** and **App secret** (these become
   `META_APP_ID` / `META_APP_SECRET`). Add the privacy policy URL
   `https://nullshift.co.uk/legal/privacy` and the app domain `nullshift.co.uk`.
4. **App roles → Roles**: make sure Louis's Facebook account is an **Admin** of the app.
   While the app is in _Development_ mode only app admins/developers/testers can log in —
   that is enough for us (it is our own account), so the connection works before App
   Review.
5. Connect: in the admin, Social → Accounts → **Connect Instagram**. Facebook Login asks
   for: `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement`, `business_management`. Grant all on the Nullshift Page. The
   callback stores a long-lived token (about 60 days), encrypted.
6. **App Review (optional, later).** Not required for publishing to our own account while
   the app stays in Development mode with Louis as admin. Needed only if the app goes Live
   or other people's accounts are connected. If submitted, request
   `instagram_content_publish`, `instagram_basic`, `pages_show_list`,
   `pages_read_engagement` with a screencast of: Accounts → Connect → approve → scheduling
   a post → it appearing on @nullshift.dev. Business verification of the "Nullshift"
   portfolio is required for `business_management`.
7. **Token renewal**: long-lived tokens expire after ~60 days. The Accounts page shows
   "expires in Nd" (amber under 7 days). Click _Reconnect Instagram_ before it lapses; if
   it does lapse, posts fall back to manual mode automatically and the account row shows
   `expired`.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable                      | Value                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| `META_APP_ID`                 | From App settings → Basic                                              |
| `META_APP_SECRET`             | From App settings → Basic (never commit it)                            |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | 32 random bytes as 64 hex chars: `openssl rand -hex 32`                |
| `SOCIAL_OAUTH_STATE_SECRET`   | Any long random string: `openssl rand -hex 32` (falls back to the key) |
| `CRON_SECRET`                 | Already set (shared by all cron routes)                                |
| `RESEND_API_KEY`              | Already set (manual-mode emails)                                       |
| `NEXT_PUBLIC_SITE_URL`        | `https://nullshift.co.uk` (used in email links; defaults to that)      |

Vercel cron entry (vercel.json): `{"path":"/api/cron/social-publish","schedule":"*/15 * * * *"}`.

## 4. Applying the migration

`supabase/migrations/0071_social_scheduler.sql` creates `social_accounts`,
`social_account_secrets` (RLS on, no policies: service role only), `social_posts`, and the
**public** storage bucket `social-media` (Instagram fetches media from a public URL, so the
bucket has to be public; uploads go through the service role after the staff guard). Apply
it the usual way (Supabase MCP `apply_migration` or the dashboard SQL editor), then update
the STATUS line at the top of the file.

## 5. Media rules (from the Graph API reference, v25.0)

- Feed image: JPEG, ≤ 8 MB, aspect 4:5 to 1.91:1, width 320–1440 px.
- Reel / feed video: MP4 or MOV, H.264/HEVC + AAC, 3 s–15 min, ≤ 300 MB, 9:16 recommended.
- Story: image ≤ 8 MB or video 3–60 s ≤ 100 MB, 9:16.
- Carousel: 2–10 items; all cropped to the first item's ratio.
- Caption: ≤ 2,200 characters, ≤ 30 hashtags, ≤ 20 @mentions. Stories have no caption.
- Instagram limit: 100 API-published posts per 24 hours (carousel = 1).

PNG uploads are accepted by the compose form for convenience but Instagram only guarantees
JPEG for images — export as JPEG to be safe.

## 6. Voice reminders (from docs/partners/PROGRAMME-BRIEF-2026-10-09.md)

Write as "we" (studio voice). Proof only from the three client stories. No "AI agency".
Do not attack monthly retainers. Plans from £40 / £80 / £120 a month. Partner enquiries go
to louis@nullshift.co.uk.
