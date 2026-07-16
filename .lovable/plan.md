Plan:

1. Update both inspection dropdowns (`RepairPicker` and `BikeCategoryPicker`) so the popover itself is constrained to the available viewport height, not just the inner list.
2. Make the option list the only scrollable area with mobile-friendly scrolling styles:
   - `overflow-y-auto`
   - `overscroll-contain`
   - `touch-action: pan-y`
   - `-webkit-overflow-scrolling: touch`
3. Stop touch/wheel scroll events from bubbling to the parent page/dialog so dragging inside the dropdown scrolls the dropdown instead of the inspection page.
4. Prevent mobile keyboard auto-focus from stealing usable dropdown space when the popover opens, while keeping the search input available to tap manually.
5. Apply the same fix everywhere these inspection pickers are used, without changing selection behavior or layout outside the dropdowns.