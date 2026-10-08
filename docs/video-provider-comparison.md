# DMQ-hosted video for follow-up conversations: provider comparison

Goal: when an expert confirms a 15-minute conversation, DMQ creates a private
room itself, so nobody pastes a Zoom or Meet link and both sides join through
DMQ. Prices and features below come from each vendor's own pages, read in
October 2026; anything marked **unverified** still needs checking in the
proof of concept (PoC) or with the vendor. Vendors change pricing, so
re-check before signing up.

## Decision: audio first, camera optional

Conversations start with the camera **off**; either person can turn it on, and
screen sharing stays available. This fits DMQ's privacy promise (the asker is
"Guest" and doesn't have to show their face), works on weaker connections and
phones, and avoids camera-permission support issues. Because we don't record,
it also reduces the chance of unrecordable bad behaviour on camera. Daily's
cheaper audio-only rate ($0.00099 vs $0.004 per participant-minute) only
applies if no video is ever sent, so we are deliberately not enforcing
audio-only: the saving is about $0.09 per conversation.

## Short recommendation

**Daily** (Prebuilt embedded in an iframe) for the PoC and a pilot. Its
access model fits our requirements best: one private room per conversation,
a separate time-limited pass per person, and a display name that we set. It
also has the cheapest free allowance. **LiveKit** is much cheaper per minute
but we would build the call screen ourselves, so it only makes sense at
volume. **Whereby Embedded** is the simplest to embed, but access is a URL
that anyone who has it can use, which is weaker for our privacy goals.

## Cost per 15-minute conversation

Two people, 15 minutes each = 30 participant-minutes. Allowing for people
arriving early, 40 is a more realistic number.

| | Free allowance | Price after | 30 min | 40 min | Fixed monthly cost |
|---|---|---|---|---|---|
| **Daily** | 10,000 participant-min/month (about 250 to 330 conversations) | $0.004 per participant-min | $0.12 | $0.16 | none (pay as you go) |
| **Whereby Embedded** | Build plan includes 2,000 min/month (about 50 to 65 conversations) | about $0.004 per participant-min | $0.12 | $0.16 | $9.99 to $10.99 (the two pages I read disagree) |
| **LiveKit Cloud** | 5,000 min/month free (about 125 to 165 conversations) | $0.0005 per min on Ship ($50/month incl. 150,000 min) | $0.015 | $0.02 | $0 free tier, then $50 |

At a $35 price DMQ's fee is $5.25, so video costs about 3% of it at list price
and nothing within the free allowance. Stripe's card fees are separate and
larger. Recording would add cost, but V1 has none.

Not evaluated in depth: Vonage Video, 100ms, Agora, Twilio, 8x8 Jitsi and
Zoom Video SDK. Third-party sources put Vonage around $0.004 per
participant-minute and Agora around $0.009, but I couldn't confirm either on
the vendors' own pages. None looks cheaper or simpler than the three above.

## Requirement by requirement

| Requirement | Daily | Whereby Embedded | LiveKit |
|---|---|---|---|
| Both join through DMQ | Iframe or JS SDK on our pages | Iframe or web component | Our own UI (React components exist) |
| No email or phone shared | Pass carries only a display name and an opaque id we choose | Name is set in the embed; no email needed | Token carries an identity and name we choose |
| Expert uses profile name, asker is "Guest" | Set in each person's pass, so it can't be typed over before joining | Set client-side in the embed (**unverified** whether it can be locked) | Set in the token |
| Unique room per conversation | Private room with a random name | Transient room per meeting | Room per conversation |
| Secure, time-limited access per participant | **Yes.** Each pass has its own start and expiry and can eject at expiry. Not one-time-use. | Room-level window only. `roomUrl` is the same for everyone and is the credential. A locked room plus the host admitting the guest is possible but adds friction. | Yes, token with expiry |
| No Zoom or Google account | Yes | Yes | Yes |
| Join and leave events | Webhooks with user name and id. **Needs a card on file.** | Webhooks with display name, role, participant id | Webhooks (not read in detail) |
| No recording | Off unless a room or pass turns it on | Off unless started by a host | Off unless started |
| Keep request and confirm | Unchanged: the room is created when someone first joins | Unchanged | Unchanged |

## Privacy

- Whichever we pick becomes a data processor for the video and audio. We'd
  need to name them in the Privacy Policy and sign their data terms.
- The provider sees display names, the opaque ids we assign and IP addresses.
  It never receives an email address or phone number, because we don't send
  them.
- **Unverified, important:** if a provider connects two people directly
  (peer to peer), each person's browser can learn the other's IP address. Daily
  should route calls through its servers by default, but the PoC must confirm
  this with the browser's WebRTC inspector (`chrome://webrtc-internals`).
- The policy line "your meeting service may show your display name" would
  change to "you'll appear as Guest", and "video meeting service" to "audio
  conversation, with optional video".

## What changes in our product if we adopt it

1. **Database:** a confirmed booking currently requires a meeting link. That
   constraint would be relaxed and a room name stored instead.
2. **Expert confirm step:** drops the link field. Choosing a time is all it
   takes, which is the main win for experts.
3. **Join:** the "open link in a new tab" step becomes a room page on DMQ
   (asker on the private join page, expert from the dashboard), reusing our
   existing join-window rules (10 minutes before to 30 after).
4. **Evidence becomes much stronger.** Today we only know someone clicked Join.
   With webhooks we'd know who was actually in the room and when. That can
   settle most cases automatically (both present for a few minutes means it
   took place) and shrinks the "only the asker joined" disputes.
5. **Security headers:** the pages with the call need a narrow exception to
   our strict policy (frame-src for the provider, camera and microphone
   allowed for it). The PoC page shows the exact change.
6. **Support:** we become responsible for call quality (Wi-Fi, firewalls,
   in-app browsers, iPhone Safari). A pilot should keep "paste your own link"
   as a fallback for experts.

My estimate for the production work is roughly three to five working days
including testing, mostly in items 3 and 4. That is a guess, not a quote.

## The proof of concept

Admin-only page at `/admin/video-poc` (menu: "Video test"). It creates a
private room with an expert pass (profile name) and a guest pass, embeds
either view in an iframe, and lists join and leave events arriving from the
webhook. No real booking, payment or email is involved.

To run it on dev:

1. Create a free Daily account. Add a card (they don't charge within the
   free allowance, and webhooks need one on file).
2. Put `DAILY_API_KEY` and `DAILY_WEBHOOK_HMAC` in `.env.local` (see
   `.env.example`) and restart the dev server.
3. Run `supabase/video_poc.sql` on the dev project.
4. Open `/admin/video-poc`, click **Create a test room**, and join as the
   expert in one browser and as the guest in another (or on a phone).
5. Webhooks: Daily must reach our URL, so this needs either the deployed site
   or a tunnel (for example `cloudflared`) with `NEXT_PUBLIC_SITE_URL` set to
   it. Then click **Register webhook (once)** and join again.

## What the PoC must prove before we choose

- [ ] Camera, microphone and screen share work in the embedded frame on
      Chrome, Safari (Mac and iPhone) and Android.
- [ ] The guest appears as "Guest" and can't rename themselves; the expert
      appears under their profile name.
- [ ] Both people join with the camera off, and either can turn it on.
- [ ] A pass doesn't work before its start or after its expiry, and people are
      removed at expiry.
- [ ] A third person can't enter with the room address alone.
- [ ] Join and leave events arrive, are signed, and match what we did.
- [ ] No recording option is offered to either person.
- [ ] No direct peer-to-peer connection (WebRTC inspector).
- [ ] Call quality is acceptable on a phone connection.

## PoC results (Daily, tested on dev 2026-10-08)

| Check | Result |
|---|---|
| Expert shows under the profile name, from the pass | Pass; no name field on the join screen |
| Asker shows as "Guest", cannot change it | Pass; no name field on the join screen |
| Camera starts off, either person can turn it on | Camera starts off (turning it on from each side still to try) |
| No recording offered | No record button on the call bar (the More menu is unchecked) |
| Both sides connect and hear each other | Pass |
| Third person with a valid pass blocked | Pass ("The meeting is full" at two people) |
| Room address without a pass refused | Pass ("You are not allowed to join this meeting"); room may have been past its expiry, re-check with a fresh room |
| No direct connection between the two people | Pass. The selected connection's remote end was a cloud server address (23.20.x.x, which I believe is Amazon's range), not the other person's address. Each page also had separate send and receive connections, typical of routing through the provider's servers. |
| Join/leave events via webhook | Not tested yet |
| Phone browser (guest pass on a phone) | Pass: worked as the guest on a phone. Device, browser, Wi-Fi to mobile data and screen-lock behaviour were not recorded; Safari on iPhone and Android in particular still worth a deliberate check before launch |
| Pass expiry ejects people | Not tested yet |

## Agreed configuration (V1)

| Feature | Setting |
|---|---|
| Microphone | On by default, subject to the browser's permission |
| Camera | Off by default; either person can turn it on |
| Display names | Expert's public name; asker appears as "Guest" |
| Screen sharing | Disabled for V1 |
| Recording | Disabled |
| Room access | Private room, separate short-lived pass per person, two people at most |
| Room opens | 10 minutes before the scheduled start |
| Call length | 15 minutes, counted from the scheduled start (not from when each person joins) |
| Grace | The room stays open 5 minutes after the 15, then closes and removes everyone |
| Late arrivals | Join any time until the room closes; the clock doesn't restart, and the charge policy is unchanged |

The policy text will need one line: "The conversation ends 15 minutes after the
scheduled start." DMQ's page shows a countdown so the end isn't a surprise.
The timing lives in `videoRoomWindowFor` in `lib/follow-up-rules.ts`.

## Validation before the production build

Six things to confirm, how each will be tested, and where it stands.

| # | Requirement | Where it stands | How to finish validating it |
|---|---|---|---|
| 1 | A unique room is created automatically when the expert confirms | Room creation through the API works and each room is unique. It is not yet wired to the real confirm step. | Build step: the room is created the first time either person asks to join (not at confirmation, so cancelled bookings leave nothing behind) and its name is stored on the booking. Test in dev: confirm, join, cancel, rebook; no orphan rooms. |
| 2 | Only the right expert and asker get in, with separate short-lived credentials | Proven: private room, a pass per person, a third person with a valid pass is refused when two are in, and the room address alone is refused. Not yet proven: that a pass fails before it opens or after it expires, and that people are ejected at expiry. | Test with the PoC page's "opens in / open for" controls (opens in 2 min, open for 3 min). Passes are made only when someone clicks Join, never emailed. A pass can be reused by the same person until it expires. |
| 3 | Participants see only DMQ display names | Proven: names come from the pass, no name field, no email or phone sent. The provider only receives the name and an opaque id. Calls go through the provider's servers, not directly between people. | In production the opaque id must be a random per-booking value (`expert-<booking id>`), never an email or account id. |
| 4 | Audio first, camera off by default | Proven: everyone joins with the camera off and can turn it on. Not enforced: audio-only. | Decision: keep the camera optional (recommended), or make audio-only a setting. The provider's pass supports restricting what a person can send; to be verified before offering it. |
| 5 | Record joins and leaves, including reconnects, without recording the call | Built in the PoC and unit-tested (8 cases: clean call, reconnect, never joined, still connected, lost event, overlapping sessions). Not yet tried with live events. | Needs the webhook reachable (a tunnel). Then join, leave, rejoin, and check the summary card matches. Times come from the provider's signed server events, not the browser. |
| 6 | Failure handling | Not tested. | Use the PoC controls: arrive late (join mid-window), early (before it opens), after it closes, drop the connection and rejoin, and have one person never join. |

### Connection summary

The PoC page shows a card per room: who joined, whether they are still
connected, reconnects, and shared connection time, with the note that this
supports troubleshooting and payment reviews but does not prove the quality
of the conversation. Rules it follows:

- Only the provider's signed events are used. A browser can't change them.
- A reconnect is a second session for the same person; time is merged so
  overlapping sessions aren't double counted.
- If a "joined" event is lost, the session is rebuilt from the "left" event.
- A session still open is counted up to now.

Decision needed for production: how much shared time counts as "it took
place" for settling a booking automatically (for example 5 minutes), and
whether the asker and expert also see the card.

## Sources

- Daily pricing: https://www.daily.co/pricing/video-sdk/
- Daily docs: https://docs.daily.co/reference/rest-api/rooms/config,
  https://docs.daily.co/reference/rest-api/meeting-tokens/config,
  https://docs.daily.co/reference/rest-api/webhooks,
  https://docs.daily.co/docs/guides/privacy-and-security/content-security-policy
- Whereby pricing: https://whereby.com/information/embedded/pricing
- Whereby docs: https://docs.whereby.com/whereby-product-features/user-roles-and-privileges.md,
  https://docs.whereby.com/whereby-product-features/insights-suite-and-api/webhooks.md,
  https://docs.whereby.com/reference/whereby-rest-api-reference/meetings.md
- LiveKit pricing: https://livekit.com/pricing
