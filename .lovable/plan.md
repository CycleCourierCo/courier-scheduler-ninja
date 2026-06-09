## Restyle bay breakdown to match management list layout

Update `buildBayBreakdown()` in `supabase/functions/send-loading-list-whatsapp/index.ts` so the WhatsApp text (and matching email HTML) uses the same visual language as the management overview message.

### New WhatsApp text format

```
🗄️ BAY BREAKDOWN - BIKES OUT TODAY

📅 Date: <same date as management msg>

🅰️ BAY A (3 bikes)
━━━━━━━━━━━━━━━━━━━━

1. <Brand> <Model>
   📍 A1
   📦 <Customer name>
   🔢 <Tracking number>
   👨‍💼 <Driver name>
   🚲 Quantity: N bikes   (only when >1)

2. ...

━━━━━━━━━━━━━━━━━━━━

🅱️ BAY B (2 bikes)
━━━━━━━━━━━━━━━━━━━━
... 

━━━━━━━━━━━━━━━━━━━━

📊 SUMMARY
• Total bikes out: X
• Bays in use: Y
```

- Bay emojis: A→🅰️, B→🅱️, C→🅲️ fallback to plain `BAY C` if no glyph (use a small map; unknown bays render as `📦 BAY <letter>`).
- Sort bays A→D, then by position ascending (unchanged).
- Each bike shown as a numbered multi-line block with the same emoji set as the management overview (`📍 📦 🔢 👨‍💼`), so the loader sees a consistent style across both messages.
- Use the same `━━━━━━━━━━━━━━━━━━━━` separator the management message uses — this also gives `splitMessage()` clean chunk boundaries.
- Pass the existing `date` string into `buildBayBreakdown(bikesFromDepot, date)` so the header matches the management message.

### Email HTML

Keep the existing bay-grouped table layout (it's already readable in email) but:
- Change the heading wording to `🗄️ Bay Breakdown - Bikes Out Today` and subtitle `Grouped by bay, sorted by position.` to mirror the WhatsApp header.
- Add a final summary line: `Total bikes out: X · Bays in use: Y`.
- No table column changes.

### Call site

Update the single call in the loader-only branch (around line 800) from `buildBayBreakdown(bikesFromDepot)` to `buildBayBreakdown(bikesFromDepot, date)`. No other call sites.

### Out of scope

- No change to management overview message, per-driver messages, management email, recipients, chunking helper, or DB.
- No new button / route / schema change.
- Driver assignment, location/position data, and sort order remain identical.

### Files

- Edit: `supabase/functions/send-loading-list-whatsapp/index.ts` (only `buildBayBreakdown` + its one call site).
