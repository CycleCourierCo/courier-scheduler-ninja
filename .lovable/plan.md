# TrackPod audit and cleanup

## What the audit found

I searched the current codebase (frontend, edge functions, config, env file, public assets) and the git history for anything TrackPod-related:

- No TrackPod code, key, URL or setting exists in the app today. The only file that ever held it, a TrackPod service in the frontend, was deleted in a commit on 15 June 2026.
- No TrackPod secret exists in the project's stored secrets, and no TrackPod value is in the env file.
- The one remaining mention is a single sentence inside an archived planning note in `.lovable/plan/`, which just lists the scanner's old findings. It is text in a document, not a key or working code.
- The old key does still live in the repository's git history from before the deletion, so it should be revoked in the TrackPod account regardless of the code being gone.

So the finding is stale: the "hardcoded key in the client bundle" no longer ships to browsers.

## Proposed actions

1. Remove the leftover TrackPod sentence from the archived plan note so no reference remains anywhere in the project.
2. Mark the TrackPod security finding as resolved, recording that the code and key were removed and that nothing TrackPod-related is bundled or stored.
3. Add a short note to security memory so future scans do not re-raise TrackPod, and so the standing rule stays clear: no third-party API keys in browser-visible code.

## Something only you can do

The key existed publicly in the past, so please revoke/delete it in the TrackPod dashboard if that has not already been done. I cannot do that, and clearing the finding does not invalidate a leaked key.

## Note on the other open finding

The exposed mapping/geocoding key in the browser bundle is a separate, still-live issue. The plan for moving it server-side is ready and waiting for your go-ahead whenever you want it done.

## Technical detail

- Files touched: `.lovable/plan/lock-down-the-shipday-edge-functions-2026-08-23.md` (one line edited).
- No code, database, secret or edge-function changes are needed for TrackPod.
- Finding cleared via the security tooling with `mark_as_fixed`, plus a security memory update.
