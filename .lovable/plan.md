# Loading list: show "Sending…" and block double sends

On the Loading page, sending the loading list gives no feedback while the WhatsApp/email edge function runs, and the button can be clicked again mid-send (risking duplicate messages to drivers).

## What changes

- Clicking the dialog's **Send Loading List** button immediately changes it to **"Sending…"** with a spinner and disables it.
- While sending, the dialog's **Cancel** button and closing the dialog (X / outside click) are also disabled, so the send can't be abandoned halfway.
- The **📱 Send Loading List** button on the page is disabled while a send is in flight.
- When it finishes: success toast as today, buttons re-enable, dialog closes. If it fails, an error toast shows and the dialog stays open with buttons re-enabled so it can be retried.

## Technical notes

- `src/pages/LoadingUnloadingPage.tsx` only; no edge function or data changes.
- Add `const [isSendingLoadingList, setIsSendingLoadingList] = useState(false);` and wrap the body of `handleSendWithDriverNumbers` in set-true / try / finally set-false.
- Dialog send button: `disabled={isSendingLoadingList}`, label `{isSendingLoadingList ? "Sending…" : "Send Loading List"}` with a `Loader2` spinner icon.
- Dialog `onOpenChange` and Cancel: ignore/bypass close while `isSendingLoadingList`. Page-level send button: `disabled={isSendingLoadingList}`.
