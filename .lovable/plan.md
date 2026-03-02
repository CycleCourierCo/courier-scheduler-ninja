

## Fix: Add `parameter_name` to SendZen parameters

The SendZen API example confirms that each parameter needs a `parameter_name` field. Our current code omits this.

### Change: `supabase/functions/send-sendzen-whatsapp/index.ts`

Add `parameter_name` to every parameter object across all 4 template types:

**review** template:
```typescript
{ type: "text", text: contactName, parameter_name: "customer_name" }
```

**collection_timeslots / delivery_timeslot** templates (6 body params):
```typescript
{ type: "text", text: contactName, parameter_name: "contact_name" },
{ type: "text", text: bikeBrand, parameter_name: "bike_brand" },
{ type: "text", text: bikeModel, parameter_name: "bike_model" },
{ type: "text", text: formattedDate, parameter_name: "date" },
{ type: "text", text: startTime, parameter_name: "start_time" },
{ type: "text", text: endTime, parameter_name: "end_time" },
```
Button parameter:
```typescript
{ type: "text", text: trackingUrl, parameter_name: "tracking_url" }
```

**grouped_timeslot** template (6 body params):
```typescript
{ type: "text", text: contactName, parameter_name: "contact_name" },
{ type: "text", text: formattedDate, parameter_name: "date" },
{ type: "text", text: startTime, parameter_name: "start_time" },
{ type: "text", text: endTime, parameter_name: "end_time" },
{ type: "text", text: collectionJobList, parameter_name: "collection_job_list" },
{ type: "text", text: deliveryJobList, parameter_name: "delivery_job_list" },
```

**Note**: The `parameter_name` values must match exactly what's defined in your WhatsApp templates. The review template uses `customer_name`. For the other templates, I'm using likely names -- if they fail, you'll need to share the exact parameter names from your SendZen dashboard for those templates too.

Then redeploy `send-sendzen-whatsapp`.

