# Add Expiring Dates to the menu

## Why it's missing

There are two menus:

- **Staff (non-admin):** built automatically from the page-permission list. Expiring Dates is already set for route planners, so they should already see it.
- **Admin:** a separate hand-written list in the layout. Expiring Dates was never added to it — that's why you can't see it.

## Change

- Add **Expiring Dates** to the **Operations** section of the admin menu (between Job Scheduling and Drivers Rota), with the same calendar-clock icon. It appears in both the desktop menu and the mobile menu automatically.

## Other pages not on any menu

Checked every page in the app against the menus. The only staff pages missing are:

- **Expiring Dates** — fixed above.
- **My Holidays** (`/my-holidays`) — drivers reach it via the permission-based staff menu, but it's not in the admin menu. I can add it under Fleet if you want.

Everything else not on the menu is a sub-page or public page that's reached from elsewhere, so it doesn't need a menu entry:

- Order/claim/conversation/knowledge/review detail pages (opened from their lists)
- New Claim form (opened from Damage Claims)
- Inbox Queues (opened from the Customer Service Inbox)
- Public pages: tracking, availability, inspection approval, repair offer, NI partner, terms/privacy/about, sign-in, password reset, API docs authorisation

## Technical details

- Edit `src/components/Layout.tsx` — add `{ to: "/expiring-dates", label: "Expiring Dates", icon: CalendarClock }` to the Operations group of `ADMIN_MENU_SECTIONS`; `CalendarClock` is added to the lucide import.
- No permission or database changes needed: route planners already have access by default, admins always have access.
- Optional: add My Holidays to the admin Fleet section — confirm whether you want this.
