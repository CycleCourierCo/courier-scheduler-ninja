

## Upgrade jsPDF to Version 4.0.0

Upgrade the jsPDF library from 3.0.1 to 4.0.0 to address the path traversal security vulnerability and future-proof the application.

---

## Summary

This is a straightforward dependency upgrade. The jsPDF 4.0.0 release explicitly states that it **does not introduce other breaking changes** beyond the security fix (which only affects Node.js builds, not browser usage).

---

## Change Required

### Update package.json

**File:** `package.json` (line 53)

| Before | After |
|--------|-------|
| `"jspdf": "^3.0.1"` | `"jspdf": "^4.0.0"` |

---

## Why This Is Safe

1. **No API changes**: The 4.0.0 release notes confirm no other breaking changes beyond the security fix
2. **Browser-only usage**: Your app uses jsPDF in the browser where the vulnerability doesn't apply
3. **Standard methods**: All methods used (`new jsPDF()`, `addPage()`, `text()`, `addImage()`, `save()`) remain unchanged
4. **Hardcoded paths**: The only image path used is `/cycle-courier-logo.png` (not user-controlled)

---

## Files Using jsPDF

| File | Usage |
|------|-------|
| `src/utils/labelUtils.ts` | Generates single order shipping labels |
| `src/pages/LoadingUnloadingPage.tsx` | Generates batch collection labels |

Both files use the same jsPDF methods and patterns, which are fully compatible with v4.0.0.

---

## Testing Recommendation

After the upgrade, test these PDF generation features:
- Generate a single order label from the order detail page
- Generate batch collection labels from the Loading/Unloading page

