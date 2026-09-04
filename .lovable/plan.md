# Why emails are being rejected for "rate limit exceeded" — and how to fix it

## What the records show

Over the last 7 days there were 414 rejected email sends. Every single one:

- came from the shared "send email" step (the one all customer emails go through),
- happened between 08:00:10 and 08:00:20 UTC,
- happened on the same days the 08:00 daily customer-update run went out (that run sent 538–544 emails in the same hour).

So this is not a general capacity problem. It is one burst: the daily update run fires
hundreds of emails within a few seconds, and the email provider only accepts a couple of
sends per second. Everything above that is refused. Nothing retries, so those customers
simply never received their update that day.

Two things make the burst worse than intended:

1. The run sends 5 orders at once, and each order can send both a sender and a receiver
   email — so up to 10 sends land at the same instant.
2. Each batch of 5 starts immediately after the previous one, with no pause, and the
   run continues into further chunks that can overlap the same second.

## The fix

1. **One shared pace-keeper for all outgoing email.** Add a small queue in the shared
   email helper so no more than 2 sends leave per second, no matter how many parts of the
   system ask at once. Everything already routes through this helper, so every email path
   benefits, not just the daily run.
2. **Automatic retry on refusal.** When the provider refuses for rate reasons, wait and
   try again (3 attempts, growing waits). This turns today's silent losses into slightly
   delayed deliveries.
3. **Calmer daily run.** Reduce the parallel batch from 5 orders to 2 and send an order's
   sender/receiver emails one after the other, so the pace-keeper is not permanently
   backed up.
4. **Keep counting properly.** Refusals that later succeed on retry should be recorded as
   one successful send with the retry noted, so the health figures reflect reality.

Expected outcome: the 08:00 run takes a few minutes longer to finish and delivers all of
its emails, instead of finishing fast and dropping around 100 of them.

## Technical notes

- Pace-keeper and retry go in `supabase/functions/_shared/integrationLog.ts` inside
  `trackResend`, wrapping `emails.send` — a module-level promise chain with a minimum
  gap of 500 ms, plus retry on `rate_limit_exceeded` / HTTP 429 with backoff
  (1s, 2s, 4s). Per-instance only, which is enough because the burst comes from a single
  invocation chain.
- `supabase/functions/send-order-updates/index.ts`: `BATCH` 5 → 2; inside
  `sendUpdatesForOrder`, await the sender email before the receiver email instead of
  sending both concurrently.
- `chainNextChunk` stays as is; the pace-keeper handles overlap, and each chunk is a
  fresh invocation.
- Redeploy `send-order-updates`, `send-email` and the other functions that import the
  shared helper so they pick up the new wrapper.
