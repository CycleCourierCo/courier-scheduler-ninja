

## Add Fuel Finder to Driver Allowed Routes

**File: `src/components/ProtectedRoute.tsx`** (line ~97-102)

Add `/fuel-finder` to the driver role's allowed routes check, alongside `/driver-timeslips` and `/profile`.

Change:
```tsx
const isTimeslipsPage = location.pathname === '/driver-timeslips';
const isProfilePage = location.pathname === '/profile';
if (userProfile?.role === 'driver') {
  if (!isTimeslipsPage && !isProfilePage) {
```

To:
```tsx
const isTimeslipsPage = location.pathname === '/driver-timeslips';
const isProfilePage = location.pathname === '/profile';
const isFuelFinderPage = location.pathname === '/fuel-finder';
if (userProfile?.role === 'driver') {
  if (!isTimeslipsPage && !isProfilePage && !isFuelFinderPage) {
```

One file, two lines changed.

