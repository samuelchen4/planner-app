# Google Calendar Integration: Design

Status: agreed design, not built yet. All of it lives in the `planner-backend` repo except the "Connect Google Calendar" button and rendering in the app.

## Principle: Google syncs into our database
The app, web app, MCP server and Siri never call Google directly. They read and write our Postgres database (devices get it through PowerSync). A backend worker keeps Google and Postgres matched. This means Google events work offline and sync like everything else, MCP/ChatGPT doesn't care where an event came from, and the OAuth, rate-limit and retry complexity sits in one place.

## Scope and phases
This app is the central hub for tasks and scheduling. Its own item types are richer than Google events.

1. **Phase 1 (now): read-only.** Events from the Google calendars the user selects appear in the day view.
2. **Phase 2 (later): push.** Planner items the user marks "show in Google" are written one-way to a dedicated **"Planner" calendar** the app creates in the user's Google account, never into their real calendars.
3. **Phase 3 (maybe): edit Google events** from the app.

## Data model
Our items and Google events are **separate tables**. The day view merges them (`DayEntry` in `packages/core`).

```
planner_items      our data, our shape (task | time_block | habit | note …)
external_events    read-only mirror of Google, written only by the sync worker
                   id, user_id, calendar_id, provider, external_id, title, location,
                   start_at, end_at, time_zone, all_day_start, all_day_end (exclusive),
                   status, updated_at
calendars          id, google_account_id, google_calendar_id, name, color, is_selected,
                   sync_token, watch_channel_id, watch_resource_id, watch_expires_at
google_accounts    id, user_id, google_sub, email, refresh_token (encrypted), scopes, status
planner_item_google_links   (phase 2) item_id, google_event_id, etag
```

- Only `external_events` and the display fields of `calendars` sync to devices. Tokens and sync state stay on the server.
- Store timestamps as `timestamptz` plus an IANA time zone, all-day items as dates, and repeats as RFC 5545 `rrule`.
- To test early: for read-only calendars, using `singleEvents=true` (Google expands repeating events) over a time window may be simplest. Confirm how it combines with incremental `syncToken` sync.

## Connecting a Google account
Logging into the app (Supabase auth: Apple, Google or email) and connecting Google Calendar are separate steps. A user may connect several Google accounts.

```
App "Connect Google Calendar" → in-app browser → api/integrations/google/start
→ Google consent (offline access → refresh token)
→ api/integrations/google/callback: exchange code, store tokens encrypted (Supabase Vault / GCP Secret Manager)
→ deep link back: planner://integrations/google/done
```

Scopes: request the minimum per phase (read-only for phase 1; Google's scope for app-created calendars fits phase 2). Google's OAuth verification for sensitive scopes takes weeks and limits us to 100 test users until it's done, so start it early (see `ios-release-guide.md`).

## Sync flow (webhooks included in phase 1)
```
Google change → POST api/webhooks/google (ping only, no event data)
             → Cloud Tasks queue → events.list(syncToken) → upsert external_events
             → PowerSync → devices (live if the app is open, on next launch otherwise)
```
- Subscribe per selected calendar with `events.watch`. Set a secret channel token and reject pings whose header doesn't match.
- Subscriptions expire (up to about a week). A daily Cloud Scheduler job renews any close to expiring.
- Webhooks can be missed, so a backup poll runs every 15–30 minutes. The `syncToken` makes it cheap and duplicate-free.
- HTTP 410 on a `syncToken` → full resync of that calendar.
- Exponential backoff on rate limits. Queue work per user.
- Local development needs a public HTTPS tunnel (`cloudflared` / `ngrok`) for webhooks.

## Later: Apple Calendar
iCloud calendars have no Google-style server API. Read them on the device with Apple's EventKit framework as an overlay. That's a separate feature and doesn't affect this design.
