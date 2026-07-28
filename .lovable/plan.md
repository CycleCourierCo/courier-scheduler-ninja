## Plan

1. **Use the proven Box My Bike upload path for Foam labels**
   - Keep the same `uploadToStorage` helper, but remove Foam-specific differences where possible.
   - Make the Foam label upload mutation match the Box label mutation structure, including how the order update is performed after upload.

2. **Fix the edge fallback deployment/runtime gap**
   - Confirm the deployed `upload-file` function includes the latest code.
   - If needed, deploy only `upload-file` so the fallback can actually run with the updated bucket and role logic.

3. **Add safe diagnostics for the failed path**
   - Improve `upload-file` logs to show non-sensitive facts only: bucket, file size, content type, auth present, and failure stage.
   - Do not log file contents, personal details, tokens, or full paths beyond the order-id prefix.

4. **Check whether the browser is failing before the function is reached**
   - The latest logs show no matching `upload-file` request after your retry, so I’ll verify whether the client is still attempting direct Storage only, being blocked by CORS/network before fallback, or using stale frontend code.

5. **Validate the fix**
   - Test the deployed `upload-file` function directly with an authenticated request shape.
   - Re-check Edge Function logs after the test.
   - Final result will clearly state whether the signed-in browser upload path was verified or if it remains unverified.