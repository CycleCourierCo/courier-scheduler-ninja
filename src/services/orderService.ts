
import { Order, CreateOrderFormData, OrderStatus } from "@/types/order";
import { toast } from "sonner";

// Mock database
let orders: Order[] = [];

// Generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Create a new order
export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  try {
    const newOrder: Order = {
      id: generateId(),
      sender: data.sender,
      receiver: data.receiver,
      status: 'sender_availability_pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Store the order
    orders.push(newOrder);
    
    // Simulate sending email to sender
    console.log(`Email sent to sender ${data.sender.email} for order ${newOrder.id}`);
    
    return newOrder;
  } catch (error) {
    console.error("Error creating order:", error);
    throw new Error("Failed to create order");
  }
};

// Get all orders
export const getOrders = async (): Promise<Order[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return orders;
};

// Get order by ID
export const getOrderById = async (id: string): Promise<Order | undefined> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return orders.find(order => order.id === id);
};

// Update order status
export const updateOrderStatus = async (id: string, status: OrderStatus): Promise<Order | undefined> => {
  const orderIndex = orders.findIndex(order => order.id === id);
  
  if (orderIndex !== -1) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      status,
      updatedAt: new Date()
    };
    return orders[orderIndex];
  }
  
  return undefined;
};

// Update sender availability
export const updateSenderAvailability = async (id: string, pickupDate: Date): Promise<Order | undefined> => {
  const orderIndex = orders.findIndex(order => order.id === id);
  
  if (orderIndex !== -1) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      pickupDate,
      status: 'receiver_availability_pending',
      updatedAt: new Date()
    };
    
    // Simulate sending email to receiver
    console.log(`Email sent to receiver ${orders[orderIndex].receiver.email} for order ${id}`);
    
    return orders[orderIndex];
  }
  
  return undefined;
};

// Update receiver availability
export const updateReceiverAvailability = async (id: string, deliveryDate: Date): Promise<Order | undefined> => {
  const orderIndex = orders.findIndex(order => order.id === id);
  
  if (orderIndex !== -1) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      deliveryDate,
      status: 'scheduled',
      updatedAt: new Date()
    };
    
    // Simulate creating Shipday order
    try {
      const trackingNumber = await createShipdayOrder(orders[orderIndex]);
      
      orders[orderIndex] = {
        ...orders[orderIndex],
        trackingNumber,
        status: 'shipped',
        updatedAt: new Date()
      };
      
      return orders[orderIndex];
    } catch (error) {
      console.error("Error creating Shipday order:", error);
      toast.error("Failed to create Shipday order");
      return orders[orderIndex];
    }
  }
  
  return undefined;
};

// Create Shipday order
const createShipdayOrder = async (order: Order): Promise<string> => {
  // Simulating Shipday API call
  console.log("Creating Shipday order with data:", order);
  
  // In a real implementation, you would make an API call to Shipday here
  // For example:
  /*
  const response = await fetch('https://api.shipday.com/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SHIPDAY_API_KEY}`
    },
    body: JSON.stringify({
      orderNumber: order.id,
      customerName: order.receiver.name,
      customerEmail: order.receiver.email,
      customerPhone: order.receiver.phone,
      pickupAddress: `${order.sender.address.street}, ${order.sender.address.city}, ${order.sender.address.state}, ${order.sender.address.zipCode}`,
      pickupBusinessName: order.sender.name,
      deliveryAddress: `${order.receiver.address.street}, ${order.receiver.address.city}, ${order.receiver.address.state}, ${order.receiver.address.zipCode}`,
      expectedPickupTime: order.pickupDate?.toISOString(),
      expectedDeliveryDate: order.deliveryDate?.toISOString()
    })
  });
  
  const data = await response.json();
  return data.trackingNumber;
  */
  
  // For now, we'll just return a mock tracking number
  return `SD-${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;
};
