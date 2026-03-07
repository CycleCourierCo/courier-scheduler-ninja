

## Plan: Admin Notice Bar Management

### Overview
Create a system where admins can add/edit/remove announcement banners that display across the website. Notices will be stored in a Supabase table and rendered globally in the Layout component.

### Database Changes

**New table: `notice_bars`**
- `id` (uuid, PK)
- `message` (text, required) — the announcement text
- `type` (text, default 'info') — style variant: info, warning, success, error
- `is_active` (boolean, default true)
- `created_by` (uuid) — admin who created it
- `created_at`, `updated_at` (timestamps)
- `expires_at` (timestamptz, nullable) — optional auto-expiry

RLS: admins can CRUD, all users (including anon) can SELECT active notices.

### Frontend Changes

**1. New page: `src/pages/NoticeBarManagement.tsx`**
- Admin-only page at `/notices`
- Table listing all notices (active/inactive)
- Form to create new notice (message, type, optional expiry)
- Toggle to activate/deactivate notices
- Delete button per notice

**2. New component: `src/components/NoticeBanner.tsx`**
- Fetches active notices from `notice_bars` where `is_active = true` and not expired
- Renders coloured banners at the top of the page (above the header)
- Dismissible per session (optional)

**3. Update `src/components/Layout.tsx`**
- Render `<NoticeBanner />` above the header

**4. Update `src/App.tsx`**
- Add route `/notices` with `<ProtectedRoute adminOnly={true}>`

**5. Update Layout navigation**
- Add "Notice Bars" link in admin menu sections (desktop dropdown + mobile sheet)

