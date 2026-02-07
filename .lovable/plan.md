

# Add Sentry Test Error Button (Admin Only)

## Overview

Add a "Test Sentry" button to the navigation menu that intentionally throws an error to verify Sentry error tracking is working correctly. This button will only be visible to admin users.

## Implementation Details

### File to Modify

| File | Changes |
|------|---------|
| `src/components/Layout.tsx` | Add test error button to both mobile and desktop menus |

### Changes

1. **Import `AlertTriangle` icon** from lucide-react for the button icon

2. **Add button to admin section of mobile Sheet menu** (around line 140, after Bicycle Inspections link):
   ```tsx
   <button 
     onClick={() => {
       throw new Error('Sentry Test Error - Triggered by admin');
     }}
     className="flex items-center text-red-500 hover:text-red-700 transition-colors"
   >
     <AlertTriangle className="mr-2 h-4 w-4" />
     Test Sentry Error
   </button>
   ```

3. **Add button to admin section of desktop DropdownMenu** (around line 317, after Bicycle Inspections):
   ```tsx
   <DropdownMenuItem
     onClick={() => {
       throw new Error('Sentry Test Error - Triggered by admin');
     }}
     className="text-red-500 hover:text-red-600 cursor-pointer"
   >
     <AlertTriangle className="mr-2 h-4 w-4" />
     <span>Test Sentry Error</span>
   </DropdownMenuItem>
   ```

### Security

- Button is only rendered inside `{isAdmin && <>...</>}` blocks
- Role check uses `userProfile?.role === 'admin'` from AuthContext
- Non-admin users will never see this button

### User Experience

- Button has red styling to indicate it's a destructive/test action
- Uses AlertTriangle icon to visually distinguish it from normal navigation
- When clicked, throws an intentional error that Sentry will capture
- The ErrorFallback component (already configured in App.tsx) will display

