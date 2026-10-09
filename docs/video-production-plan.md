# DMQ-hosted audio conversations: production build plan

Status: all four slices built and switched off. Next: test on dev, then the production Daily account and the policy wording review before release. Builds on the proof of concept and the agreed
configuration in `docs/video-provider-comparison.md` (provider: Daily).

## What changes for people

- **Expert:** confirming a request means choosing a time. No Zoom or Meet link
  to paste. They join from their Conversations page.
- **Asker:** the private page they already have (`/meet/<id>`) shows the call
  itself, in the page. Camera off by default, shown as "Guest".
- **DMQ:** knows from the provider's signed events who was actually in the
  room and for how long, so most no-show and "did it happen" questions answer
  themselves.

## Design decisions already made

Audio first, camera optional, no screen sharing, no recording, private room
with a personal short-lived pass per person (two people max), room opens 10
minutes before the start, 15 minutes counted from the scheduled start, 5
minutes of grace, then it closes. Names: the expert's public name, and
"Guest".

## Slices

Each slice can be released on its own, and the first two ship switched off
until the third is ready. In-flight bookings never change: each booking
remembers which way it was set up.

### Slice 1: foundation (about 1 day, dormant)

- **SQL** (`supabase/video_rooms.sql`):
  - `follow_up_calls.video_provider` (`external` default, or `dmq`) and
    `video_room_name`.
  - Replace the rule that a confirmed booking must have a meeting link with
    one that requires a link only when `video_provider = 'external'`.
  - `follow_up_video_sessions`: one row per connection (booking, role,
    provider session id, joined at, left at). Server-only.
- **Server:**
  - `lib/video/room.ts`: get or create the room for a booking, safe if two
    people click at once (the room name is claimed on the booking row first).
    Rooms are created at first join, never at confirmation, so cancelled
    bookings leave nothing behind.
  - `lib/video/pass.ts`: makes a pass for one person at the moment they click
    Join. Display name from the profile or "Guest"; the opaque id is
    `expert-<booking id>` / `asker-<booking id>`; opens and closes from
    `videoRoomWindowFor`; camera off; no screen sharing; ejected at expiry.
    Passes are never emailed or logged.
  - Promote the PoC webhook to `/api/video/webhook`: verify the signature,
    find the booking from the room name, upsert sessions, write timeline
    events. Unknown rooms are ignored.
- **Config:** `FOLLOW_UP_VIDEO=dmq|external` (default `external`).
  `DAILY_API_KEY` and `DAILY_WEBHOOK_HMAC` in Vercel.
- **Spending guard (server side):** before creating a room, check two limits
  and refuse if either is hit: rooms created in the last 24 hours
  (`VIDEO_MAX_ROOMS_PER_DAY`) and calls connected right now
  (`VIDEO_MAX_CONCURRENT`). Limits are generous defaults you can raise. When
  one is hit the person sees "We can't start the call right now, please try
  again in a few minutes", and support is emailed so it never fails silently.
  Rooms already have two-person and expiry caps, and passes are rate limited.
  Also set a usage alert in Daily's dashboard (to confirm what Daily offers).

### Slice 2: confirm and join (about 2 days)

- **Expert confirm:** with the flag on, the request card drops the link field.
  Optional, collapsed: "Use my own meeting link instead" (the fallback for the
  pilot, controlled by the expert). The server marks the booking `dmq` or
  `external` accordingly. When an external link is used it is clearly marked:
  the asker's page and emails say "This conversation uses the expert's own
  meeting link", and the privacy lines for that booking keep the old wording
  about the meeting service showing display names.
- **Join:** `join` and `join-asker` return an embedded call instead of a
  link when the booking is `dmq`. New call component with a countdown ("call
  time left", then "grace period"), a Leave button and rejoin if the
  connection drops.
  - Asker: inside `/meet/<id>`.
  - Expert: a call page opened from the Conversations card.
- **Security headers:** a narrow exception for those two pages only (frame-src
  for Daily, camera and microphone allowed for Daily), the same shape as the
  PoC's. Everything else stays locked.
- **Wording:**
  - Policy lines and privacy lines: "You'll appear as Guest", audio with
    optional camera, not recorded, the video service processes the call, and
    "The conversation ends 15 minutes after the scheduled start". Bump the
    policy version.
  - Emails: the confirmed, reminder and request emails stop mentioning
    pasting a link or "your meeting service".
  - Pricing page explainer: remove "add your own Zoom or Google Meet link".
- **Rate limits** on the join endpoints already exist; passes are minted per
  click.

### Slice 3: evidence and settlement (about 1.5 days)

Today settlement is based on who clicked Join. With connection data:

| What the data shows | Outcome |
|---|---|
| Both connected and shared time at least 10 minutes | Eligible for automatic completion (charged after the asker's review window, as now) |
| Expert connected, asker never did | Asker no-show (charge, with the 24-hour review) |
| Asker connected, expert never did | Expert no-show: release, no charge. Trustworthy now, because the expert can only be in the room through DMQ. |
| Both connected, shared time under 10 minutes | Needs the asker's confirmation, or review (never charged automatically) |
| Neither | Release, no charge |
| No connection data at all, but join clicks exist | Held for review (the webhook may have failed; never release or charge on silence) |

- **Safety net:** when settling, if events look missing, ask Daily's records
  (their meeting logs / presence API) to fill in. Exact calls to be confirmed
  while building.
- **Admin:** the disputed-conversation screen shows the connection card from
  the PoC (expert and asker status, reconnects, shared time) above the existing
  timeline.
- **Participants:** admin-only to start (decision below).
- **Old path kept:** `external` bookings keep settling from join clicks.

### Slice 4: failure handling and polish (about 1 day)

Walk through each case with the PoC controls and fix what surfaces: late
arrival, pass not yet open, pass expired, dropped connection and rejoin, one
person never joining, an in-app browser (Instagram, Gmail) that blocks the
microphone (show a "open in your browser" hint), and expert on a poor
connection.

Built: an in-app browser hint with a copy-link button; a reload button in the
call; an expert escape hatch ("Use my own meeting link") that moves a booking to
the expert's own link and emails the asker; a backup that, before settling,
completes missing connection records from the provider's own record of the
room; and an admin Video card (switch state, rooms and calls against the
limits, when a connection was last recorded).

Dropped on purpose: deleting rooms when a booking ends. Rooms close on their
own at the end of the window, and deleting one early would remove the
provider's own record of the call, which is evidence in a dispute.

## Testing

- **Unit:** room window, connection summary (done), the settlement table
  above, pass contents (name, id, expiry).
- **Dev end to end** (adds to `docs/follow-up-calls-dev-test-checklist.md`):
  confirm, both join, reconnect, leave, auto-complete from shared time, one
  side absent, both absent, webhook delivered late.
- **Devices:** Chrome, Safari and Firefox on desktop; Safari on iPhone;
  Chrome on Android; one slow mobile connection.
- **Security:** passes not in any email or log; third person refused;
  unsigned webhook refused; exceptions limited to the two call pages.

## Rollout

1. Deploy with the flag off. Nothing changes for anyone.
2. Turn on in dev, run the checklist, then on prod for one or two allowed
   experts (the existing beta allowlist).
3. Watch the first conversations by hand (admin screen, error log).
4. Widen only after a clean batch.

## Risks

- **Call quality becomes our problem.** Mitigation: audio-first (light on
  bandwidth), the fallback link during the pilot, and a clear "report a
  problem" path.
- **Webhook gaps.** Mitigation: never settle automatically on missing data.
- **Provider cost or terms change.** The code keeps the provider behind two
  small files (`room`, `pass`), so a switch is a contained change.
- **Privacy wording.** The Privacy Policy must name the video provider and say
  what it sees (display names, opaque ids, IP addresses, not email or phone).

## Estimate

About 4 to 6 working days in total including testing: slice 1 about 1, slice
2 about 2, slice 3 about 1.5, slice 4 about 1, plus a day's buffer. This is my
estimate, not a quote.

## Decisions

Answered:

1. **Shared-time threshold:** 10 minutes makes a booking eligible for automatic
   completion. Shorter calls need the asker's confirmation or review.
2. **Fallback link:** kept for the pilot, expert-controlled and clearly marked.
3. **Connection card:** admin only for V1.
4. **Provider account:** a dedicated, DMQ business-owned Daily account, not a
   personal one. Production keys wait for it (the LLC, bank account and card),
   so slice 1 can be built and tested on the test account but not released.
5. **Spending guard:** usage alerts plus a server-side limit on room creation
   and concurrent calls (see slice 1).

Still open:

6. **Wording review:** who reviews the updated policy and Privacy Policy text.

Original list, for reference:

1. **Threshold:** how many minutes of shared time count as "it took place"
   (suggest 5).
2. **Fallback link:** keep "use my own link" for the pilot (recommended), or
   DMQ video only.
3. **Who sees the connection card:** admin only (recommended to start), or the
   asker and expert too.
4. **Provider account:** move to a business Daily account (and a business
   card) before production. The PoC account is personal and on a test card.
5. **Spending guard:** check what limit or alert Daily offers before real use.
6. **Policy and Privacy Policy wording:** who reviews the updated text.
