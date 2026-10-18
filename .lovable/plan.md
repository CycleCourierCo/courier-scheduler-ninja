# Make "Open selected in new tabs" open every route

## Why only one opened
Browsers only let one click open one new tab. Every tab after the first gets blocked as a pop-up, so you only saw the first route. This is even more likely inside the Lovable preview.

## The fix
- The button still tries to open every ticked route at once. If you allow pop-ups for the site, they'll all open in one go.
- If the browser blocks any of them, the popup stays open and shows a short list: "Blocked by your browser — open these:". Each route has its own **Open** link. One click opens one tab, and browsers always allow that, so you can open the rest quickly. A link greys out once you've opened it.
- The message also tells you how to allow pop-ups. In Chrome, click the blocked pop-up icon at the right of the address bar and choose "Always allow".

## Technical details
- `LoadRouteDialog.tsx`: `handleOpenSelected` collects the routes where `window.open` returned `null` into `blockedRoutes` state. It also treats tabs as blocked when it can't confirm they opened, by checking `w.closed` right away. The blocked list renders real `<a href target="_blank" rel="noopener">` links, which the browser opens without the pop-up check, and marks each one as opened when clicked. The list clears when the popup closes or the selection changes.
- Nothing changes in the Scheduling page's `?savedRoute=` loading.
