CREATE OR REPLACE FUNCTION public._build_public_order_payload(v_order orders, p_reveal_side text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sender jsonb;
  v_receiver jsonb;
  v_inspection_summary jsonb;
  v_pickup_id text;
  v_delivery_id text;
  v_updates jsonb;
  v_events jsonb;
  v_foam_photos jsonb;
  v_has_foam_photos boolean;
BEGIN
  v_sender := CASE WHEN v_order.sender IS NULL THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'name',    v_order.sender->>'name',
      'city',    v_order.sender->>'city',
      'country', v_order.sender->>'country'
    ))
  END;

  v_receiver := CASE WHEN v_order.receiver IS NULL THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'name',    v_order.receiver->>'name',
      'city',    v_order.receiver->>'city',
      'country', v_order.receiver->>'country'
    ))
  END;

  v_foam_photos := to_jsonb(v_order.foam_delivery_photos);
  v_has_foam_photos := (
    v_foam_photos IS NOT NULL
    AND jsonb_typeof(v_foam_photos) = 'array'
    AND jsonb_array_length(v_foam_photos) > 0
  );

  IF v_order.tracking_events IS NOT NULL AND v_order.tracking_events ? 'shipday' THEN
    v_pickup_id   := v_order.tracking_events->'shipday'->>'pickup_id';
    v_delivery_id := v_order.tracking_events->'shipday'->>'delivery_id';

    SELECT jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'event',        u->>'event',
        'orderId',      u->>'orderId',
        'timestamp',    u->>'timestamp',
        'description',  u->>'description',
        'leg',          u->>'leg',
        'has_pod',       (jsonb_typeof(u->'podUrls') = 'array' AND jsonb_array_length(u->'podUrls') > 0),
        'has_signature', (u->>'signatureUrl' IS NOT NULL AND length(u->>'signatureUrl') > 0),
        'podUrls', CASE
          WHEN p_reveal_side = 'sender'
               AND (u->>'leg' = 'pickup' OR (v_pickup_id IS NOT NULL AND u->>'orderId' = v_pickup_id))
            THEN u->'podUrls'
          WHEN p_reveal_side = 'receiver'
               AND (u->>'leg' = 'delivery' OR (v_delivery_id IS NOT NULL AND u->>'orderId' = v_delivery_id))
            THEN u->'podUrls'
          ELSE NULL
        END,
        'signatureUrl', CASE
          WHEN p_reveal_side = 'sender'
               AND (u->>'leg' = 'pickup' OR (v_pickup_id IS NOT NULL AND u->>'orderId' = v_pickup_id))
            THEN u->>'signatureUrl'
          WHEN p_reveal_side = 'receiver'
               AND (u->>'leg' = 'delivery' OR (v_delivery_id IS NOT NULL AND u->>'orderId' = v_delivery_id))
            THEN u->>'signatureUrl'
          ELSE NULL
        END
      ))
    )
    INTO v_updates
    FROM jsonb_array_elements(v_order.tracking_events->'shipday'->'updates') u;

    v_events := jsonb_build_object(
      'shipday', jsonb_build_object(
        'pickup_id',   v_pickup_id,
        'delivery_id', v_delivery_id,
        'updates',     COALESCE(v_updates, '[]'::jsonb)
      )
    );
  ELSE
    v_events := NULL;
  END IF;

  IF v_order.needs_inspection THEN
    v_inspection_summary := public.get_public_inspection_summary(
      COALESCE(v_order.tracking_number, v_order.id::text)
    );
  END IF;

  RETURN jsonb_build_object(
    'id',                              v_order.id,
    'user_id',                         NULL,
    'sender',                          v_sender,
    'receiver',                        v_receiver,
    'status',                          v_order.status,
    'created_at',                      v_order.created_at,
    'updated_at',                      v_order.updated_at,
    'tracking_number',                 v_order.tracking_number,
    'bike_brand',                      v_order.bike_brand,
    'bike_model',                      v_order.bike_model,
    'bike_type',                       v_order.bike_type,
    'bike_quantity',                   v_order.bike_quantity,
    'customer_order_number',           v_order.customer_order_number,
    'is_bike_swap',                    v_order.is_bike_swap,
    'is_ebay_order',                   v_order.is_ebay_order,
    'needs_inspection',                v_order.needs_inspection,
    'is_northern_ireland',             v_order.is_northern_ireland,
    'foam_status',                     v_order.foam_status,
    'pickup_date',                     v_order.pickup_date,
    'delivery_date',                   v_order.delivery_date,
    'scheduled_pickup_date',           v_order.scheduled_pickup_date,
    'scheduled_delivery_date',         v_order.scheduled_delivery_date,
    'scheduled_at',                    v_order.scheduled_at,
    'sender_confirmed_at',             v_order.sender_confirmed_at,
    'receiver_confirmed_at',           v_order.receiver_confirmed_at,
    'pickup_timeslot',                 v_order.pickup_timeslot,
    'delivery_timeslot',               v_order.delivery_timeslot,
    'collection_confirmation_sent_at', v_order.collection_confirmation_sent_at,
    'delivery_confirmation_sent_at',   v_order.delivery_confirmation_sent_at,
    'order_collected',                 v_order.order_collected,
    'order_delivered',                 v_order.order_delivered,
    'tracking_events',                 v_events,
    'is_box_my_bike',                  v_order.is_box_my_bike,
    'box_my_bike_status',              v_order.box_my_bike_status,
    'box_in_depot_at',                 v_order.box_in_depot_at,
    'box_boxed_at',                    v_order.box_boxed_at,
    'box_label_printed_at',            v_order.box_label_printed_at,
    'box_collected_by_3p_at',          v_order.box_collected_by_3p_at,
    'box_delivered_by_3p_at',          v_order.box_delivered_by_3p_at,
    'box_tracking_url',                v_order.box_tracking_url,
    'bikes', CASE WHEN v_order.bikes IS NULL THEN NULL ELSE
      (SELECT jsonb_agg(jsonb_build_object(
        'brand',    b->>'brand',
        'model',    b->>'model',
        'type',     b->>'type',
        'quantity', b->>'quantity'
      )) FROM jsonb_array_elements(v_order.bikes) b)
    END,
    'sender_notes',                    v_order.sender_notes,
    'receiver_notes',                  v_order.receiver_notes,
    'inspection_summary',              v_inspection_summary,
    'revealed_side',                   p_reveal_side
  )
  || jsonb_build_object(
    'foam_pending_collection_at', v_order.foam_pending_collection_at,
    'foam_pending_foaming_at',    v_order.foam_pending_foaming_at,
    'foam_foamed_at',             v_order.foam_foamed_at,
    'foam_delivered_to_ferry_at', v_order.foam_delivered_to_ferry_at,
    'foam_delivered_ni_at',       v_order.foam_delivered_ni_at,
    'has_foam_photos',            v_has_foam_photos,
    'foam_delivery_photos', CASE
      WHEN p_reveal_side = 'receiver' THEN v_foam_photos
      ELSE NULL
    END
  );
END;
$function$;