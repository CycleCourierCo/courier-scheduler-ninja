## Problem

The Box My Bike label upload fails with "Bucket not found" because the `box-my-bike-labels` storage bucket was never created. The migration `20260603213537_...sql` added the orders columns and left a comment saying the bucket would be created via the storage tool, but that step never ran. There are also no RLS policies on `storage.objects` for this bucket.

## Fix

1. **Create the bucket** `box-my-bike-labels` as **private** (labels contain shipping data and shouldn't be publicly listable). The app already uses `createSignedUrl` to read them, which works on private buckets.

2. **Add RLS policies on `storage.objects`** for this bucket via migration:
   - **Customer (order owner)** can `INSERT`/`UPDATE`/`SELECT` an object whose path starts with `<their order id>/` for an order where `orders.user_id = auth.uid()` and `is_box_my_bike = true`.
   - **Admin/staff roles** (admin, warehouse, dispatcher — whichever roles currently manage Box My Bike, matching existing patterns) get full `SELECT/INSERT/UPDATE/DELETE`.
   - `service_role` bypasses RLS, so edge functions keep working.

3. **No frontend changes** — the upload path `supabase.storage.from("box-my-bike-labels").upload(path, ...)` already works once the bucket exists.

## Verification

After the bucket + policies are live, re-try the upload as the customer on the Box My Bike page — the toast should switch from "Bucket not found" to "Label uploaded", and the "No label uploaded yet" row should flip to the signed-URL view.

## Question before I build

The path used for the object is defined in `BoxMyBikePage.tsx` around line 131 — I'll read it before writing the policies so the ownership check (`storage.foldername(name)[1] = order.id`) matches exactly. No decision needed from you unless you want the bucket to be **public** instead of private (not recommended for shipping labels).
