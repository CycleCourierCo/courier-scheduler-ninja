## Diagnosis

Do I know what the issue is? Yes, at least for the remaining failure path:

- The direct Storage upload is still failing as a transport/network failure.
- The fallback edge-function upload is also failing before it can complete, with `Failed to send a request to the Edge Function`.
- The current frontend then throws the original direct-upload message, so the user only sees “connection dropped” even though the fallback also failed.
- The `upload-file` edge function logs only show boot/shutdown, with no useful upload error, so the fix needs better fallback transport and better diagnostics.

## Plan

1. **Replace the fallback transport**
   - Stop using `supabase.functions.invoke("upload-file", { body: FormData })` for file fallback uploads.
   - Call the edge function URL directly with explicit auth/API headers so browser/network errors are easier to distinguish from function errors.
   - Keep the same storage path and bucket validation.

2. **Add a JSON/base64 fallback mode**
   - Update `upload-file` to accept either:
     - existing `multipart/form-data`, or
     - JSON containing bucket, path, filename, content type, and base64 file data.
   - Use JSON/base64 as the final fallback because small PDF labels like this are well within the 20MB limit and it avoids mobile/FormData upload quirks.

3. **Improve error reporting**
   - If the fallback fails, show the fallback’s actual status/message instead of always showing the original “connection dropped” message.
   - Keep Sentry capture, but avoid logging personal data or file contents.

4. **Verify the function and CORS path**
   - Ensure every response from `upload-file`, including validation and unexpected errors, returns CORS headers.
   - Deploy/test the edge function after changes using a small test upload request where possible.

5. **Keep the UI unchanged**
   - The Foam My Bike label upload button and progress text stay where they are.
   - This is only a reliability fix for the upload path.