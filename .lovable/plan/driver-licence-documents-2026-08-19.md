# Driver Licence Documents

Add a Licence section for drivers in User Management, so admins can store a photo of the licence front, the licence back, and the DVLA check code document, plus licence number and expiry.

## What admins will see

In User Management → edit a driver → new **Licence** tab (only shown for users with the driver role):

- Three upload slots: **Licence front**, **Licence back**, **Check code document**
  - Accepts images (JPG/PNG) and PDF for the check code doc, max 10MB each
  - Shows a thumbnail/preview once uploaded, with View and Replace/Remove actions
  - Upload date shown under each slot
- **Licence number** text field
- **Licence expiry** date field
  - Amber "Expires in X days" badge when under 60 days, red "Expired" badge when past
- Save button persists everything with the rest of the profile edits

The driver list keeps a small red/amber dot on drivers with missing documents or an expired licence, so gaps are visible without opening each record.

## Data and storage

- New private storage bucket `driver-licences`, files stored under `<driver_user_id>/front.<ext>`, `/back.<ext>`, `/check-code.<ext>`
- Storage policies: only admins (and timeslip admins) can read/write; nobody else, including the driver, since uploads are admin-only
- Previews use short-lived signed URLs
- New `profiles` columns: `licence_front_path`, `licence_back_path`, `licence_check_code_path`, `licence_number`, `licence_expiry`, `licence_updated_at`

## Technical notes

- Migration adds the nullable columns to `public.profiles`; bucket created via the storage tool, then RLS policies on `storage.objects` scoped with `has_role(auth.uid(), 'admin')` / `'timeslip_admin'`
- New component `src/components/user-management/DriverLicenceTab.tsx` used inside `EditUserDialog.tsx` alongside the existing Driver and Pay tabs
- Uploads go through the existing `supabase.storage` client path used elsewhere for admin-only buckets; file type/size validated client-side before upload
- `UserProfile` type in `src/types/user.ts` extended with the new fields
