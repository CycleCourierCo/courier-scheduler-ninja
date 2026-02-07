

## Change Timeslot Sending Delay to 1 Minute

A simple update to increase the delay between WhatsApp messages from 30 seconds to 1 minute (60 seconds).

---

## Changes Required

### File: `src/components/scheduling/RouteBuilder.tsx`

**Change 1 - Line 1771-1773** (delay after grouped locations):
- Current: `await new Promise(resolve => setTimeout(resolve, 30 * 1000));`
- New: `await new Promise(resolve => setTimeout(resolve, 60 * 1000));`
- Update comment from "30-second delay" to "1-minute delay"

**Change 2 - Line 1877-1879** (delay between standalone jobs):
- Current: `await new Promise(resolve => setTimeout(resolve, 30 * 1000));`
- New: `await new Promise(resolve => setTimeout(resolve, 60 * 1000));`
- Update comment from "30-second delay" to "1-minute delay"

---

## Impact

- A route with 10 stops will now take approximately 9 minutes to send all messages (instead of 4.5 minutes)
- The browser tab must remain open during sending
- Individual "Send" buttons remain immediate (no delay)

