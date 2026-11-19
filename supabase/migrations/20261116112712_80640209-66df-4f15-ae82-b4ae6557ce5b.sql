INSERT INTO public.order_invoice_links (order_id, quickbooks_invoice_id, quickbooks_invoice_number, quickbooks_invoice_url, invoice_date, link_source, transport_net_amount)
SELECT bi.order_id, bi.service_invoice_id, bi.service_invoice_number,
       'https://qbo.intuit.com/app/invoice?txnId=' || bi.service_invoice_id,
       (bi.service_invoiced_at AT TIME ZONE 'Europe/London')::date,
       'invoice_creation', 0
FROM public.bicycle_inspections bi
WHERE bi.service_invoice_id IS NOT NULL
ON CONFLICT (order_id, quickbooks_invoice_id) DO NOTHING;