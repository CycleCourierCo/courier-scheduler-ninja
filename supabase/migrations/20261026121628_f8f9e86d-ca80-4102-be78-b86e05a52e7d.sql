UPDATE public.saved_routes sr
SET job_data = sub.fixed
FROM (
  SELECT sr2.id, jsonb_agg(
    CASE WHEN alt.wa IS NOT NULL AND (j->>'address') ILIKE (alt.wa->>'street') || '%'
              AND alt.wa->>'lat' IS NOT NULL
         THEN j || jsonb_build_object('lat', (alt.wa->>'lat')::float8, 'lon', (alt.wa->>'lon')::float8, 'addressSource', 'work')
         ELSE j END ORDER BY ord) AS fixed,
    bool_or(alt.wa IS NOT NULL AND (j->>'address') ILIKE (alt.wa->>'street') || '%' AND (j->>'lat')::float8 IS DISTINCT FROM (alt.wa->>'lat')::float8) AS changed
  FROM public.saved_routes sr2,
       jsonb_array_elements(sr2.job_data) WITH ORDINALITY AS e(j, ord)
       LEFT JOIN LATERAL (
         SELECT CASE WHEN j->>'type'='delivery' THEN o.receiver_alt_location->'work_address'
                     WHEN j->>'type'='pickup' THEN o.sender_alt_location->'work_address' END AS wa
         FROM public.orders o WHERE o.id::text = j->>'orderId'
       ) alt ON true
  WHERE jsonb_typeof(sr2.job_data)='array'
  GROUP BY sr2.id
) sub
WHERE sr.id = sub.id AND sub.changed;