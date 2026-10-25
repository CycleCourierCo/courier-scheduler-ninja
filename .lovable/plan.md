# Fix the "page with no styling" after an update

## Why it happened
The page in your screenshot loaded the app but not its styling file. That's why everything shows as plain blue links and grey browser buttons.

Each time the site is published, the app and its styling get new file names. Your normal Chrome still had the **old** page saved and reused it. That old page asked for the old styling file, which no longer exists after the new publish. So the app ran with no styling.

Incognito has no saved copy, so it fetched the new page and everything matched. Nothing is broken for customers on a fresh visit. It only affects browsers holding a saved copy from before a publish.

**Quick fix for you now:** in Chrome, open Settings > Privacy > Delete browsing data > "Cached images and files", or long-press refresh and choose a hard reload.

## Changes so it fixes itself
1. **Self-repair on load.** When the app starts, it checks that its styling actually loaded. If it didn't, the page reloads itself once and skips the saved copy. If it's still missing after that, it shows a short "Please refresh" message instead of a jumbled page.
2. **Never reuse an old main page.** The main page is marked "always check for a newer version", so Chrome can't hold onto an outdated one after a publish. The app and styling files keep long caching, because their names change every release.
3. **Recover when a page section fails to load.** The app already loads some pages on demand. If one of those pieces is missing after an update, the app reloads once instead of showing a blank or broken screen.

## Technical details
- `index.html`: inline script in `<head>`, run after load:
  - check that `getComputedStyle(document.documentElement).getPropertyValue('--background')` is non-empty
  - if it's empty and no `sessionStorage` flag is set, set the flag and call `location.reload()` with a `?v=<timestamp>` cache-bust
  - also listen for `error` events on `link[rel=stylesheet]`
- `index.html`: add `<meta http-equiv="Cache-Control" content="no-cache">`. Hosting headers control most of this, so the meta tag plus the runtime check is the dependable part.
- `src/main.tsx`: `window.addEventListener('vite:preloadError', …)` triggers a one-time reload (Vite's built-in event for missing chunk or CSS files after a deploy).
- Use a `sessionStorage` guard on both so they can never loop.
- Verify with Playwright: block the CSS request once and confirm the page reloads and comes back styled. Block it permanently and confirm the fallback message shows.
