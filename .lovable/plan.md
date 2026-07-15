## Fix: "View / print" doesn't open a new tab for loaders (or anyone) on Box My Bike

**Root cause:** `viewLabel` in `src/pages/BoxMyBikePage.tsx` awaits `createSignedUrl` and then calls `window.open(signedUrl, "_blank")`. Browsers only allow popups that fire synchronously from a user gesture — because the `await` breaks the gesture chain, the popup is silently blocked in most browsers (Safari, Firefox, and Chrome with strict popup settings). This isn't a permissions problem: the RLS policy on `box-my-bike-labels` already grants `admin`, `cs_agent`, and `loader` full access, and the signed URL is being generated successfully.

### Change

**`src/pages/BoxMyBikePage.tsx` — `viewLabel`**

Open the window synchronously first (still inside the click handler), then redirect it to the signed URL once it resolves. Fall back to same-tab navigation if the popup was blocked, and toast on failure.

```ts
const viewLabel = async (path: string) => {
  // Open synchronously to keep the user-gesture; browsers block popups opened after await.
  const win = window.open("", "_blank");
  const { data, error } = await supabase.storage
    .from("box-my-bike-labels")
    .createSignedUrl(path, 60 * 10);

  if (error || !data?.signedUrl) {
    if (win) win.close();
    toast.error("Could not load label");
    return;
  }

  if (win && !win.closed) {
    win.location.href = data.signedUrl;
  } else {
    // Popup blocked — navigate current tab as fallback.
    window.location.href = data.signedUrl;
  }
};
```

No other file, RLS, or edge function changes needed.

### Verification
Log in as a loader → open Box My Bike → click "View / print" on an order that has a label uploaded → the label opens in a new tab (or same tab if popups are blocked), and the browser's print dialog is available from there.
