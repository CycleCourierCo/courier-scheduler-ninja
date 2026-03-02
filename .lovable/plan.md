

## Problem
The grouped WhatsApp message fails with SendZen error 400: `"Parameter of type 'text' requires a 'text' value."` 

The root cause is on **line 549-550** of the edge function: when either `collectionJobList` or `deliveryJobList` is empty (`""`), SendZen rejects it because a `text` parameter cannot be an empty string.

The individual delivery timeslot works fine because it doesn't have these optional parameters.

## Fix

**`supabase/functions/send-sendzen-whatsapp/index.ts`** (lines 549-550)

Change the fallback from empty string `""` to a space or dash character that SendZen will accept:

```
// Before
{ type: "text", text: collectionJobList || "", parameter_name: "collection_job_list" },
{ type: "text", text: deliveryJobList || "", parameter_name: "delivery_job_list" },

// After  
{ type: "text", text: collectionJobList || " ", parameter_name: "collection_job_list" },
{ type: "text", text: deliveryJobList || " ", parameter_name: "delivery_job_list" },
```

A single space `" "` satisfies SendZen's non-empty text requirement while rendering invisibly in the WhatsApp message. If that causes formatting issues, we can use `"None"` or `"-"` instead.

No other changes needed — email and Shipday are already working correctly for grouped messages.

