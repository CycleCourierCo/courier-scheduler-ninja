
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OrderStatus } from '@/types/order';

interface AvailabilityOrder {
  id: string;
  sender: any;
  receiver: any;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  pickupDate?: Date | Date[];
  deliveryDate?: Date | Date[];
  senderNotes?: string;
  receiverNotes?: string;
  trackingNumber?: string;
}

type AvailabilityType = 'sender' | 'receiver';

interface UseAvailabilityProps {
  type: AvailabilityType;
  updateFunction: (id: string, dates: Date[], notes?: string) => Promise<any>;
  getMinDate: (order: AvailabilityOrder | null) => Date;
  isAlreadyConfirmed: (order: AvailabilityOrder | null) => boolean;
}

export const useAvailability = ({
  type,
  updateFunction,
  getMinDate,
  isAlreadyConfirmed
}: UseAvailabilityProps) => {
  const { id } = useParams<{ id: string }>();
  const [dates, setDates] = useState<Date[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<AvailabilityOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date>(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchOrder() {
      try {
        if (!id) {
          console.error("Order ID is missing from URL params");
          setError("Order ID is missing");
          setIsLoading(false);
          return;
        }

        console.log(`Fetching order with ID: ${id}`);
        
        // With the public access policy, we can directly fetch the order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        
        if (orderError) {
          console.error(`Error fetching order directly:`, orderError);
          setError("Failed to load order details. Please try again later.");
          setIsLoading(false);
          return;
        }
        
        if (!orderData) {
          console.error(`Order not found with ID: ${id}`);
          setError("Order not found. The link might be invalid or the order has been deleted.");
          setIsLoading(false);
          return;
        }

        console.log("Order data:", orderData);
        
        // Convert the order data to our expected format
        const formattedOrder: AvailabilityOrder = {
          id: orderData.id,
          sender: orderData.sender,
          receiver: orderData.receiver,
          status: orderData.status,
          createdAt: new Date(orderData.created_at),
          updatedAt: new Date(orderData.updated_at),
          pickupDate: orderData.pickup_date ? 
            Array.isArray(orderData.pickup_date) ?
              orderData.pickup_date.map((d: string) => new Date(d)) :
              new Date(orderData.pickup_date as string)
            : undefined,
          deliveryDate: orderData.delivery_date ?
            Array.isArray(orderData.delivery_date) ?
              orderData.delivery_date.map((d: string) => new Date(d)) :
              new Date(orderData.delivery_date as string)
            : undefined,
          senderNotes: orderData.sender_notes,
          receiverNotes: orderData.receiver_notes,
          trackingNumber: orderData.tracking_number
        };
        
        setOrder(formattedOrder);
        
        // Set minimum date based on the provided function
        const calculatedMinDate = getMinDate(formattedOrder);
        setMinDate(calculatedMinDate);
        
        // Check if already confirmed
        if (isAlreadyConfirmed(formattedOrder)) {
          setError("already_confirmed");
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error(`Error fetching order:`, err);
        setError("Failed to load order details. Please try again later.");
        setIsLoading(false);
      }
    }

    fetchOrder();
  }, [id, getMinDate, isAlreadyConfirmed]);

  const handleSubmit = async () => {
    if (dates.length === 0) {
      toast.error(`Please select at least one date for ${type === 'sender' ? 'pickup' : 'delivery'}`);
      return;
    }

    if (!id) {
      toast.error("Order ID is missing");
      return;
    }

    try {
      console.log("Starting submission with dates:", dates);
      console.log("Notes:", notes);
      setIsSubmitting(true);
      
      // Use the service function to update availability
      const result = await updateFunction(id, dates, notes);
      console.log("Update result:", result);
      
      if (!result) {
        toast.error("Failed to confirm your availability. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      toast.success("Your availability has been confirmed");
      // Show confirmation page
      setError("availability_confirmed");
      setIsSubmitting(false);
    } catch (err) {
      console.error(`Error updating ${type} availability:`, err);
      // More detailed error message
      let errorMessage = "Failed to confirm your availability";
      if (err instanceof Error) {
        errorMessage += `: ${err.message}`;
      } else if (typeof err === 'object' && err !== null) {
        const errorObj = err as any;
        if (errorObj.message) {
          errorMessage += `: ${errorObj.message}`;
        }
        // If it's a database error with a code
        if (errorObj.code) {
          errorMessage += ` (Error code: ${errorObj.code})`;
        }
      }
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  return {
    id,
    dates,
    setDates,
    notes,
    setNotes,
    isLoading,
    isSubmitting,
    order,
    error,
    minDate,
    navigate,
    handleSubmit
  };
};
