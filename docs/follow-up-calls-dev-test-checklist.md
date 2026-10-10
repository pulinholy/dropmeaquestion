# Follow-up calls: dev test checklist

Paid 15-minute follow-up conversations, offered to an asker after the expert
answers their question. See `supabase/` for the SQL and `lib/follow-up*.ts`
for the rules.

Run this on **dev only**. Several steps edit booking rows directly to skip
waiting days. Tick each box as you go. If something fails, note the booking row
(section 6) and the `error_logs` output.

## 0. Setup (once)

- [ ] In the **dev** Supabase SQL Editor, run in order: `follow_up_settings.sql`,
      `follow_up_calls.sql`, `follow_up_settlement.sql`, `follow_up_review.sql`,
      `follow_up_per_answer.sql`, `follow_up_beta.sql`, `follow_up_evidence.sql`, plus `rate_limits.sql` if it isn't there yet.
- [ ] Start the Stripe webhook forwarder:
      `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
      Make sure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the `whsec_...`
      it prints, then restart the dev server.
- [ ] You have an **expert with Stripe connected** in test mode
      (`stripe_onboarded` is true).
- [ ] You can read an asker email address. Use a plus address, e.g.
      `you+asker1@gmail.com`.
- [ ] As admin: Admin > Experts > **Allow follow-ups** for that expert. A second
      expert who isn't allowed must not see the Pricing section.
- [ ] As the expert: Pricing, then "Follow-up conversations", tick the box, set
      **$35**, save.
- [ ] Open `/dashboard/conversations`. The "Conversations" menu item should now
      show.

## 1. Happy path

- [ ] **Ask** a question as the asker (use the plus address) and pay with
      `4242 4242 4242 4242`, any future date, any CVC and ZIP.
- [ ] **Answer** it as the expert. The asker's email should contain
      "Want to talk it through...? Book 15 minutes — $35".
- [ ] **Book:** click the link, then propose 2-3 times in the next 1-4 days.
  - [ ] A time under 24 hours away is refused.
  - [ ] "Continue to payment" is blocked until the policy box is ticked.
- [ ] **Pay** with `4242...`. In Stripe (test mode) the payment shows
      **Uncaptured**, not Succeeded.
- [ ] **Hold check:**
      `stripe payment_intents retrieve pi_XXX --expand latest_charge` shows
      `capture_before` about 7 days out.
- [ ] **Emails:** the asker gets "request was sent", and the expert gets
      "new follow-up request".
- [ ] **Expert:** `/dashboard/conversations` shows the request under
      "Waiting for you", with a count in the menu.
  - [ ] A link like `https://example.com/x` is rejected.
  - [ ] `https://meet.google.com/abc-defg-hij` is accepted.
  - [ ] Choose a time and **Confirm**.
- [ ] **Confirm emails:** the asker gets "confirmed" with the join page link,
      and the expert gets "confirmed". Two **scheduled** reminder emails per
      person appear in the Resend dashboard if the call is more than 24 hours
      out.
- [ ] **Asker join page** (`/meet/<id>` from the email) shows the time and
      "button appears in about N hours". The page source must **not** contain
      the meeting link.

## 2. Skip ahead in time (dev SQL)

Put the booking `id` in each snippet.

| To test | Run |
|---|---|
| Join window open | `update follow_up_calls set confirmed_start = now() + interval '5 minutes' where id = '...';` |
| Late-cancel zone | `... set confirmed_start = now() + interval '3 hours' ...` |
| Free-cancel zone | `... set confirmed_start = now() + interval '30 hours' ...` |
| Call started, slot not over | `... set confirmed_start = now() - interval '5 minutes' ...` |
| Slot over (no-show possible) | `... set confirmed_start = now() - interval '25 minutes' ...` |
| Ready for auto-settle | `... set confirmed_start = now() - interval '26 hours' ...` |
| Request expired | `update follow_up_calls set confirm_by = now() - interval '1 hour' where id = '...' and status = 'requested';` |
| Reset who joined | `... set asker_joined_at = null, expert_joined_at = null ...` |

**DMQ-hosted bookings:** the room is created the first time someone joins, with
the booking's time at that moment. If you change `confirmed_start` after
anyone has joined, also clear the room so a fresh one is made, or the call shows
"This meeting is no longer available":

```sql
update follow_up_calls
set video_room_name = null, video_room_url = null, video_room_created_at = null
where id = '...';
```

Run the daily job by hand:

```bash
curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron/reconcile-payments
```

## 3. Endings

For each, book a **fresh** call first (one live booking per question, so use a
new question). Check the booking `status`, the Stripe payment state, and both
emails.

| Test | Do | Expect |
|---|---|---|
| **Complete (asker confirms)** | Window open. Both click **Join** (expert on the dashboard, asker on the join page). After the start, expert clicks **Mark completed**: it is only recorded (`expert_marked`), and Stripe stays **Uncaptured**. After the slot ends, the asker clicks **Yes, it took place** on the join page | `completed`. Stripe **Succeeded**, with a transfer to the expert. Both emails |
| **Complete (asker silent)** | As above, but the asker does nothing. Set `confirmed_start` to 26 hours ago and run the daily job | `completed` and charged, from the expert's mark plus the join clicks |
| **Review email** | Confirm a call 2+ hours out, then in Resend check the scheduled "How was your conversation...?" email (start + 20 min) | Scheduled; disappears if the call is cancelled |
| **Asker free cancel** | 30h away, asker cancels | `cancelled`. Stripe **Canceled**. Not charged |
| **Request a different time** | 30h away, asker clicks it | `cancelled`, Stripe **Canceled**, asker lands on the booking page and can book again; both emails mention new times. At 3h away the button isn't shown |
| **Late cancel** | 3h away, asker cancels. The button says "Cancel and pay $35" and a confirm appears | `late_cancelled`. **Succeeded** |
| **Too late** | Started, asker tries to cancel | Refused, with a "Report a problem" hint |
| **Decline** | Expert clicks "None of these work" | `declined`. Canceled. Asker gets "propose new times" |
| **Expert cancels** | Confirmed call, expert cancels | `cancelled` (by expert). Canceled. Asker is told and can book another time |
| **Asker no-show** | Slot over, asker never joined, expert clicks **Asker didn't join** | Recorded only (still `confirmed`, **Uncaptured**). After the daily job runs a day after the call: `asker_no_show`, **Succeeded**. The button must be disabled until the slot has ended |
| **No-show blocked** | Same, but the asker had clicked Join | Button disabled, and the API refuses |
| **Problem report** | After the start, asker or expert clicks Report, picks a reason (try each, and "Something else" with and without a note) | `disputed`. Stripe still **Uncaptured**. Alert email arrives at the support inbox with the reason and note. `/admin/conversations` shows them, plus a **Timeline** of everything that happened |
| **Admin resolve** | `/admin/conversations`: try each of the 3 buttons on 3 different disputes | Charge, release, release and record that the expert didn't show |
| **Expiry** | Set `confirm_by` to the past, run the job | `expired`. Canceled. Asker emailed |

## 4. Daily-job auto-settlement

Set `confirmed_start` to 26 hours ago, set the join times, then run the job:

- [ ] Both joined (or the expert marked it completed and the asker joined):
      `completed` and charged.
- [ ] Only the expert joined: `asker_no_show` and charged.
- [ ] Only the asker joined: `disputed` (manual review).
- [ ] Neither joined: `expired` and released.

## 6c. Failure handling for DMQ-hosted conversations (slice 4)

- [ ] **In-app browser:** open the asker's join page inside Instagram or another
      app's built-in browser (or send yourself the link in a chat app and tap
      it): a hint says to open it in Safari or Chrome, with a "Copy this page's
      link" button. In a normal browser there is no hint.
- [ ] **Stalled call:** in the call, "Trouble connecting? Reload" reloads it on
      the same pass; "Leave conversation" then Join makes a fresh pass.
- [ ] **Having trouble connecting?** It is one quiet link (inside the call, on
      the asker's page and on the expert's card once the call has started). It
      opens tips first (microphone, reload, browser, connection). Only after
      "It's still not working" does it show **Reschedule for free** and
      **Report a problem**.
- [ ] **Reschedule for free:** works for either side from the start until the
      room closes (20 minutes after the start), asks for confirmation, releases
      the card (Stripe **Canceled**), makes the booking `cancelled`, and emails
      both (the asker with a "book another time" link). Refused before the
      start, after the room closes, and once the two have 10+ minutes together.
      With the 14-day offer period over, the asker's email has no booking link.
- [ ] **Backfill:** with the webhook NOT registered, hold a real call, skip 26
      hours ahead and run the daily job: it still settles from the provider's
      own record (look for "video_sessions_backfilled" in the booking's
      timeline). Provider records are only kept for a limited time, so do this
      the same day.
- [ ] **Admin Video card:** `/admin/conversations` shows the switch state,
      rooms in the last 24 hours, calls in progress and when a connection was
      last recorded.

## 4b. Settling a DMQ-hosted conversation (slice 3)

For a booking held on DMQ the daily job decides from who was actually in the
room (the connection records), not from who clicked Join. Use real calls, or
`scripts/video-webhook-test.mts`, then set `confirmed_start` to 26 hours ago
and run the daily job (section 2). Expected:

| Connection data | Result |
|---|---|
| Both connected, 10+ minutes together | `completed`, charged |
| Both connected, 2 to 10 minutes together | `disputed` (reason "short call") |
| Both connected, under 2 minutes together | `disputed` (reason "connection failure") |
| Expert in, asker never clicked Join or connected | `asker_no_show`, charged |
| Expert in, asker clicked Join but never connected | `disputed` |
| Asker in, expert never connected | `expert_no_show`, released |
| Asker in, but the expert marked it completed | `disputed` (conflict) |
| Nobody connected, nobody clicked | `expired`, released |
| Nobody connected, but someone clicked Join or the expert marked it | `disputed` (no data), never released or charged |

- [ ] In `/admin/conversations` a held DMQ booking shows the **Connection** card
      (who joined, reconnects, shared time) and the reason the system held it.
- [ ] The alert email names the reason, not "only the asker joined".
- [ ] An external-link booking still settles from join clicks as before.

## 5. Edge cases

- [ ] **Declined card** `4000 0000 0000 0002` at checkout: no booking progresses.
- [ ] **Close the payment page**, then book again: the new attempt works.
- [ ] **Reminders cancelled:** cancel a confirmed call, and its scheduled emails
      disappear in Resend.
- [ ] **Per-answer opt-out:** untick "Offer this asker a 15-minute follow-up
      conversation" when answering. The email has no offer, and the booking
      page for that question says it isn't available.
- [ ] **Offer window:** edit the question's `answered_at` to 15 days ago. The
      booking page says the offer has ended.
- [ ] **Phone check:** open the join page and the Conversations page at phone
      width.

## 6. Check the logs

```sql
select created_at, source, message from error_logs order by created_at desc limit 20;
```

After a clean run there should be nothing from `follow-up...` sources. To see a
booking:

```sql
select id, status, confirmed_start, confirm_by, captured_at, released_at,
       asker_joined_at, expert_joined_at, settlement_reason, capture_before
from follow_up_calls order by created_at desc limit 5;
```

For any capture or release, `captured_at` or `released_at` should be filled. If
it's empty and the Stripe state is wrong, that's a bug to report.

## 6b. DMQ-hosted conversations (slice 2)

Needs `supabase/video_rooms.sql`, `DAILY_API_KEY` and `DAILY_WEBHOOK_HMAC` in
`.env.local`, and `FOLLOW_UP_VIDEO=dmq` (restart the dev server). With the
switch unset, everything above behaves exactly as before.

- [ ] **Confirm without a link:** the request card shows "The conversation takes
      place on DMQ... There is nothing to paste" and **Confirm this time** works
      with no link. There is no own-link choice at confirmation. If a link is sent
      anyway the server ignores it.
- [ ] **Emails:** the asker's confirmation says it takes place on DMQ as an
      audio call (or, for an own-link booking, says it uses the expert's own
      link). Policy lines include "The conversation lasts 15 minutes...".
- [ ] **Join early:** before 10 minutes ahead, Join is unavailable. Use the
      time-skip table (section 2) to move `confirmed_start`.
- [ ] **Join (both sides):** at 5 minutes ahead both click Join. The call opens
      inside the page (asker's `/meet/<id>`, expert's Conversations page) with
      a countdown. Names: the expert's profile name and "Guest". Camera off.
- [ ] **Countdown and close:** it shows time left, then "The 15 minutes are up.
      The room closes in...", then the room closes about 5 minutes after the end.
- [ ] **Leave and rejoin** works; a third person with the address and no pass
      is refused.
- [ ] **Free reschedule** (see 6c): a call that won't connect can be rescheduled
      from "Having trouble connecting?"; nobody is charged and both are emailed.
- [ ] **Limit:** set `VIDEO_MAX_ROOMS_PER_DAY=1`, confirm a second DMQ booking
      and try to join: "We can't start the call right now", and an email to
      support.
- [ ] **Webhook:** with a tunnel and the webhook registered, joins and leaves
      appear in `follow_up_video_sessions` (or run
      `scripts/video-webhook-test.mts`).
- [ ] **Phone:** the asker's page on a phone, in the phone's normal browser.

## 7. Clean up

```sql
delete from follow_up_calls where created_at > now() - interval '1 day';
```

Then switch the expert's follow-ups back off on the Pricing page.
