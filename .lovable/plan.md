

## Bulk Update Opening Hours for Approved B2B Profiles

### What
Set opening hours for all 93 approved B2B profiles to:
- **Sunday to Thursday**: Open 09:00 - 21:00
- **Friday and Saturday**: Closed

### How
Run a single SQL UPDATE using the insert tool:

```sql
UPDATE profiles
SET opening_hours = '{
  "sunday":    {"open": true,  "start": "09:00", "end": "21:00", "is24h": false},
  "monday":    {"open": true,  "start": "09:00", "end": "21:00", "is24h": false},
  "tuesday":   {"open": true,  "start": "09:00", "end": "21:00", "is24h": false},
  "wednesday": {"open": true,  "start": "09:00", "end": "21:00", "is24h": false},
  "thursday":  {"open": true,  "start": "09:00", "end": "21:00", "is24h": false},
  "friday":    {"open": false, "start": "",      "end": "",      "is24h": false},
  "saturday":  {"open": false, "start": "",      "end": "",      "is24h": false}
}'::jsonb
WHERE (is_business = true OR role = 'b2b_customer')
  AND account_status = 'approved';
```

No code changes needed -- the app already reads `opening_hours` from profiles.

