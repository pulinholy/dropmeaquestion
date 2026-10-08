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

## 7. Clean up

```sql
delete from follow_up_calls where created_at > now() - interval '1 day';
```

Then switch the expert's follow-ups back off on the Pricing page.
