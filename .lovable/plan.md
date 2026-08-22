# Remove duplicate menu entries

In the mobile menu, "Track Order", "Create Order" and "Bulk Upload" appear twice: once in the top nav links block and again inside the grouped section list below (Orders section for admins, permitted-pages list for other staff).

## Change

In `src/components/Layout.tsx`:
- Keep the top nav block minimal for signed-in users: only "Home" (and "Sign In" for signed-out visitors, which also keeps "Track Order" visible to the public).
- Drop the "Create Order" and "Bulk Upload" links from that top block for signed-in users, since both already appear in the grouped Orders section / permitted pages list.
- Keep "Track Order" in the top block only when nobody is signed in; for signed-in users it stays in the grouped section, so no duplicate.

Result: each page appears exactly once in the menu, on both mobile and desktop.
