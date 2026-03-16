UPDATE profiles
SET opening_hours = '{"sunday":{"open":true,"start":"09:00","end":"21:00","is24h":false},"monday":{"open":true,"start":"09:00","end":"21:00","is24h":false},"tuesday":{"open":true,"start":"09:00","end":"21:00","is24h":false},"wednesday":{"open":true,"start":"09:00","end":"21:00","is24h":false},"thursday":{"open":true,"start":"09:00","end":"21:00","is24h":false},"friday":{"open":false,"start":"","end":"","is24h":false},"saturday":{"open":false,"start":"","end":"","is24h":false}}'::jsonb
WHERE (is_business = true OR role = 'b2b_customer')
  AND account_status = 'approved';