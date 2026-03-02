

## Fix: Grouped WhatsApp Still Failing

The single space `" "` fallback is still being rejected by SendZen. Changing to descriptive text fallbacks.

### Change

**`supabase/functions/send-sendzen-whatsapp/index.ts`** — lines 549-550:

```
// Before
{ type: "text", text: collectionJobList || " ", parameter_name: "collection_job_list" },
{ type: "text", text: deliveryJobList || " ", parameter_name: "delivery_job_list" },

// After
{ type: "text", text: collectionJobList || "No collections", parameter_name: "collection_job_list" },
{ type: "text", text: deliveryJobList || "No deliveries", parameter_name: "delivery_job_list" },
```

Then redeploy the edge function.

