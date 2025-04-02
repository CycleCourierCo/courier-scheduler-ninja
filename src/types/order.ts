
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
  | 'cancelled';

export type Order = {
  id: string;
  user_id: string;  // This property is needed for user filtering
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  pickupDate?: Date | Date[];
  deliveryDate?: Date | Date[];
  scheduledPickupDate?: Date;
  scheduledDeliveryDate?: Date;
  senderConfirmedAt?: Date;
  receiverConfirmedAt?: Date;
  scheduledAt?: Date;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  trackingNumber?: string;
  bikeBrand?: string;
  bikeModel?: string;
  customerOrderNumber?: string;
  needsPaymentOnCollection?: boolean;
  isBikeSwap?: boolean;
  deliveryInstructions?: string;
  senderNotes?: string;
  receiverNotes?: string;
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
  bikeBrand: string;
  bikeModel: string;
  customerOrderNumber?: string;
  needsPaymentOnCollection: boolean;
  isBikeSwap: boolean;
  deliveryInstructions?: string;
};
