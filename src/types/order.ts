
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
  | 'scheduled'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type Order = {
  id: string;
  sender: ContactInfo & { address: Address };
  receiver: ContactInfo & { address: Address };
  pickupDate?: Date | Date[];
  deliveryDate?: Date | Date[];
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  trackingNumber?: string;
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
};
