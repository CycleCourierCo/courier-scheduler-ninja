
import { Order, OrderStatus } from "@/types/order";

export const mapDbOrderToOrderType = (dbOrder: any): Order => {
  if (!dbOrder) {
    throw new Error("Cannot map null or undefined database order");
  }

  
  
  // Convert date strings to Date objects where applicable with validation
  const parseDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    const parsedDate = new Date(dateValue);
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  };

  const result: Order = {
    id: dbOrder.id,
    user_id: dbOrder.user_id,
    sender: dbOrder.sender,
    receiver: dbOrder.receiver,
    status: dbOrder.status as OrderStatus,
    createdAt: parseDate(dbOrder.created_at),
    updatedAt: parseDate(dbOrder.updated_at),
    trackingNumber: dbOrder.tracking_number,
    bikeBrand: dbOrder.bike_brand,
    bikeModel: dbOrder.bike_model,
    bikeType: dbOrder.bike_type,
    bikeQuantity: dbOrder.bike_quantity || 1,
    customerOrderNumber: dbOrder.customer_order_number,
    needsPaymentOnCollection: dbOrder.needs_payment_on_collection,
    paymentCollectionPhone: dbOrder.payment_collection_phone,
    isBikeSwap: dbOrder.is_bike_swap,
    isEbayOrder: dbOrder.is_ebay_order || false,
    collectionCode: dbOrder.collection_code,
    deliveryInstructions: dbOrder.delivery_instructions,
    senderNotes: dbOrder.sender_notes,
    receiverNotes: dbOrder.receiver_notes,
    senderPolygonSegment: dbOrder.sender_polygon_segment,
    receiverPolygonSegment: dbOrder.receiver_polygon_segment,
    pickupTimeslot: dbOrder.pickup_timeslot,
    deliveryTimeslot: dbOrder.delivery_timeslot,
    // Handle optional date fields
    trackingEvents: dbOrder.tracking_events,
    storage_locations: dbOrder.storage_locations,
    loaded_onto_van: dbOrder.loaded_onto_van || false,
    loaded_onto_van_at: dbOrder.loaded_onto_van_at ? parseDate(dbOrder.loaded_onto_van_at) : undefined,
    collection_driver_name: dbOrder.collection_driver_name,
    delivery_driver_name: dbOrder.delivery_driver_name,
    needsInspection: dbOrder.needs_inspection || false,
    createdViaApi: dbOrder.created_via_api || false,
    bikeValue: dbOrder.bike_value || undefined,
    bikes: dbOrder.bikes || undefined,
    isBoxMyBike: dbOrder.is_box_my_bike || false,
    boxMyBikeStatus: dbOrder.box_my_bike_status || null,
    boxLabelUrl: dbOrder.box_label_url || null,
    boxTrackingUrl: dbOrder.box_tracking_url || null,
    boxLabelUploadedAt: dbOrder.box_label_uploaded_at ? parseDate(dbOrder.box_label_uploaded_at) : null,
    boxLabelUploadedBy: dbOrder.box_label_uploaded_by || null,
    boxMyBikeInvoiceId: dbOrder.box_my_bike_invoice_id || null,
    boxMyBikeInvoiceNumber: dbOrder.box_my_bike_invoice_number || null,
    boxMyBikeInvoiceUrl: dbOrder.box_my_bike_invoice_url || null,
    boxInDepotAt: dbOrder.box_in_depot_at ? parseDate(dbOrder.box_in_depot_at) : null,
    boxBoxedAt: dbOrder.box_boxed_at ? parseDate(dbOrder.box_boxed_at) : null,
    boxLabelPrintedAt: dbOrder.box_label_printed_at ? parseDate(dbOrder.box_label_printed_at) : null,
    boxCollectedBy3pAt: dbOrder.box_collected_by_3p_at ? parseDate(dbOrder.box_collected_by_3p_at) : null,
    boxDeliveredBy3pAt: dbOrder.box_delivered_by_3p_at ? parseDate(dbOrder.box_delivered_by_3p_at) : null,
    destinationRegion: dbOrder.destination_region || null,
    isNorthernIreland: dbOrder.is_northern_ireland || false,
    niDirection: dbOrder.ni_direction || null,
    foamStatus: dbOrder.foam_status || null,
    foamPendingCollectionAt: dbOrder.foam_pending_collection_at ? parseDate(dbOrder.foam_pending_collection_at) : null,
    foamPendingFoamingAt: dbOrder.foam_pending_foaming_at ? parseDate(dbOrder.foam_pending_foaming_at) : null,
    foamFoamedAt: dbOrder.foam_foamed_at ? parseDate(dbOrder.foam_foamed_at) : null,
    foamDeliveredToFerryAt: dbOrder.foam_delivered_to_ferry_at ? parseDate(dbOrder.foam_delivered_to_ferry_at) : null,
    foamDeliveredNiAt: dbOrder.foam_delivered_ni_at ? parseDate(dbOrder.foam_delivered_ni_at) : null,
    foamDeliveryPhotos: dbOrder.foam_delivery_photos || null,
    // Public tracking payload flags that photos exist even when the paths are
    // withheld until the receiver verifies their postcode.
    foamHasPhotos:
      dbOrder.has_foam_photos ??
      ((dbOrder.foam_delivery_photos?.length || 0) > 0),
  };


  // Add optional date fields only if they exist in the DB record
  if (dbOrder.pickup_date) {
    result.pickupDate = dbOrder.pickup_date;
  }

  if (dbOrder.delivery_date) {
    result.deliveryDate = dbOrder.delivery_date;
  }

  if (dbOrder.scheduled_pickup_date) {
    result.scheduledPickupDate = parseDate(dbOrder.scheduled_pickup_date);
  }

  if (dbOrder.scheduled_delivery_date) {
    result.scheduledDeliveryDate = parseDate(dbOrder.scheduled_delivery_date);
  }

  if (dbOrder.sender_confirmed_at) {
    result.senderConfirmedAt = parseDate(dbOrder.sender_confirmed_at);
  }

  if (dbOrder.receiver_confirmed_at) {
    result.receiverConfirmedAt = parseDate(dbOrder.receiver_confirmed_at);
  }

  if (dbOrder.scheduled_at) {
    result.scheduledAt = parseDate(dbOrder.scheduled_at);
  }

  if (dbOrder.collection_confirmation_sent_at) {
    result.collectionConfirmationSentAt = parseDate(dbOrder.collection_confirmation_sent_at);
  }

  if (dbOrder.delivery_confirmation_sent_at) {
    result.deliveryConfirmationSentAt = parseDate(dbOrder.delivery_confirmation_sent_at);
  }

  return result;
};

export const doesOrderNeedDrivers = (order: Order): boolean => {
  return order.status === 'scheduled' && !order.trackingEvents?.shipday;
};
