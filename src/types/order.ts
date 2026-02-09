
export type ContactInfo = {
  name: string;
  email: string;
  phone: string;
};

export type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  lat?: number;
  lon?: number;
};

// Update OrderStatus to include delivery statuses
export type OrderStatus = 
  | 'created' 
  | 'sender_availability_pending'
  | 'sender_availability_confirmed'
  | 'receiver_availability_pending'
  | 'receiver_availability_confirmed'
  | 'scheduled_dates_pending'
  | 'pending_approval' // Keep for backward compatibility
  | 'scheduled'
  | 'driver_to_collection' // New status
  | 'collected' // New status
  | 'driver_to_delivery' // New status
  | 'shipped' // Existing status, keep for compatibility
  | 'delivered'
  | 'cancelled'
  | 'collection_scheduled'  // New status
  | 'delivery_scheduled';    // New status

export type ShipdayUpdate = {
  status: string;
  timestamp: string;
  orderId: string;
  description?: string;
  event?: string;
  podUrls?: string[];
  signatureUrl?: string;
  driverName?: string;
};

export type Order = {
  id: string;
  user_id: string;  // This property is needed for user filtering
  sender: ContactInfo & { address: Address };
  needsInspection?: boolean;
  receiver: ContactInfo & { address: Address };
  pickupDate?: Date | Date[];
  deliveryDate?: Date | Date[];
  scheduledPickupDate?: Date;
  scheduledDeliveryDate?: Date;
  pickupTimeslot?: string;
  deliveryTimeslot?: string;
  senderConfirmedAt?: Date;
  receiverConfirmedAt?: Date;
  scheduledAt?: Date;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  trackingNumber?: string;
  bikeBrand?: string;
  bikeModel?: string;
  bikeType?: string;
  bikeQuantity?: number;
  customerOrderNumber?: string;
  needsPaymentOnCollection?: boolean;
  paymentCollectionPhone?: string;
  isBikeSwap?: boolean;
  isEbayOrder?: boolean;
  collectionCode?: string;
  deliveryInstructions?: string;
  senderNotes?: string;
  receiverNotes?: string;
  senderPolygonSegment?: number;  // Changed from polygonSegment to senderPolygonSegment
  receiverPolygonSegment?: number; // Added receiverPolygonSegment for delivery addresses
  storage_locations?: any; // Add storage_locations field for database storage
  loaded_onto_van?: boolean; // Track if bikes have been loaded onto van
  loaded_onto_van_at?: Date; // Track when bikes were loaded onto van
  collection_driver_name?: string | null; // Driver assigned for collection/pickup
  delivery_driver_name?: string | null; // Driver assigned for delivery
  trackingEvents?: {
    shipday?: {
      pickup_id?: string;
      delivery_id?: string;
      last_status?: string;
      last_updated?: string;
      updates?: ShipdayUpdate[];
    };
  };
  inspection_status?: 'pending' | 'inspected' | 'issues_found' | 'in_repair' | 'repaired' | null;
  createdViaApi?: boolean;
};

export type CreateOrderFormData = {
  sender: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      lat?: number;
      lon?: number;
    };
  };
  receiver: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      lat?: number;
      lon?: number;
    };
  };
  bikeQuantity: number;
  bikes: Array<{
    brand: string;
    model: string;
    type: string;
  }>;
  customerOrderNumber?: string;
  needsPaymentOnCollection: boolean;
  paymentCollectionPhone?: string;
  isBikeSwap: boolean;
  partExchangeBikeBrand?: string;
  partExchangeBikeModel?: string;
  partExchangeBikeType?: string;
  isEbayOrder: boolean;
  collectionCode?: string;
  deliveryInstructions?: string;
  needsInspection: boolean;
  // Legacy fields for backward compatibility
  bikeBrand?: string;
  bikeModel?: string;
  bikeType?: string;
};
