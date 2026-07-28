## Plan

Use the working Box My Bike label storage path for Foam My Bike labels from upload through viewing.

### What I’ll change
- Update Foam My Bike label uploads to write to `box-my-bike-labels` instead of `foam-my-bike-labels`.
- Update Foam My Bike label viewing/printing to create signed URLs from `box-my-bike-labels`.
- Keep storing the uploaded path in `orders.foam_label_url`, so the Foam workflow and tracking link requirement continue to work as they do now.
- Remove the separate Foam label bucket constant so this cannot accidentally point back to the failing bucket.

### Database/storage access
- Extend the existing working `box-my-bike-labels` storage policies so Northern Ireland/Foam orders are allowed in the same way Box My Bike orders are allowed.
- Preserve the existing Box rules for Box My Bike orders.
- Do not create a new bucket and do not rely on `foam-my-bike-labels` for labels anymore.

### Verification
- Confirm the final Foam code uses `box-my-bike-labels` for both upload and signed URL viewing.
- Confirm the storage policy for `box-my-bike-labels` covers both `is_box_my_bike = true` and `is_northern_ireland = true` order folders.
- Because this project’s auth is external/unmanaged in the sandbox, I cannot complete a signed-in browser upload here; I’ll report that separately rather than claiming end-to-end upload verification.