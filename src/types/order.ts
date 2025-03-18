
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
};

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

export type Order = {
  id: string;
  user_id: string;  // Make sure to include this property in the type
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  pickupDate?: Date | Date[];
  deliveryDate?: Date | Date[];
  scheduledPickupDate?: Date;
  scheduledDeliveryDate?: Date;
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
    };
  };
  bikeBrand: string;
  bikeModel: string;
  customerOrderNumber?: string;
  needsPaymentOnCollection: boolean;
  isBikeSwap: boolean;
  deliveryInstructions?: string;
};
