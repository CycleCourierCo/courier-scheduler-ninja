
export type OrderStatus =
  | 'created'
  | 'sender_availability_pending'
  | 'sender_availability_confirmed'
  | 'receiver_availability_pending'
  | 'receiver_availability_confirmed'
  | 'pending_approval'
  | 'scheduled'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  address: Address;
}

export interface Order {
  id: string;
  user_id: string;
  sender: ContactInfo;
  receiver: ContactInfo;
  pickupDate?: Date[];
  deliveryDate?: Date[];
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
  trackingEvents?: any[]; // Will store Shipday tracking events
}

export interface CreateOrderFormData {
  sender: ContactInfo;
  receiver: ContactInfo;
  bikeBrand?: string;
  bikeModel?: string;
  customerOrderNumber?: string;
  needsPaymentOnCollection?: boolean;
  isBikeSwap?: boolean;
  deliveryInstructions?: string;
}

// Form fields for the sender availability page
export interface SenderAvailabilityFormData {
  dates: Date[];
}

// Form fields for the receiver availability page
export interface ReceiverAvailabilityFormData {
  dates: Date[];
}
