
import { useState, useEffect, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPublicOrder } from "@/services/fetchOrderService";
import { Order } from "@/types/order";
import { format } from "date-fns";

type AvailabilityType = 'sender' | 'receiver';

interface UseAvailabilityProps {
  type: AvailabilityType;
  updateFunction: (id: string, dates: Date[], notes: string) => Promise<Order | null>;
  getMinDate: () => Date;
  isAlreadyConfirmed: (order: Order | null) => boolean;
}

export const useAvailability = ({
  type,
  updateFunction,
  getMinDate,
  isAlreadyConfirmed
}: UseAvailabilityProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dates, setDates] = useState<Date[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<Date>(getMinDate());
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadOrder = async () => {
      if (!id || hasAttemptedLoad) {
        return;
      }

      try {
        setIsLoading(true);
        console.log(`Loading order with ID: ${id}, URL path: ${window.location.pathname}`);
        
        const fetchedOrder = await getPublicOrder(id);
        
        // Prevent state updates if component unmounted
        if (!isMounted) return;
        
        setHasAttemptedLoad(true);
        
        if (!fetchedOrder) {
          console.error("Order not found with ID:", id);
          setError("Order not found. The link may be invalid or expired.");
          setIsLoading(false);
          return;
        }

        console.log("Order loaded successfully:", fetchedOrder.id, "Status:", fetchedOrder.status);
        setOrder(fetchedOrder);

        // For receiver: set min date to earliest date from sender's availability 
        if (type === 'receiver' && fetchedOrder.pickupDate && Array.isArray(fetchedOrder.pickupDate) && fetchedOrder.pickupDate.length > 0) {
          // Find the earliest date from sender's availability
          let earliestDate: Date | null = null;
          
          fetchedOrder.pickupDate.forEach(dateStr => {
            const date = new Date(dateStr);
            if (!earliestDate || date < earliestDate) {
              earliestDate = date;
            }
          });
          
          if (earliestDate) {
            console.log("Setting min date for receiver to earliest sender date:", earliestDate);
            setMinDate(earliestDate);
          }
        }

        // Check if the availability is already confirmed
        if (isAlreadyConfirmed(fetchedOrder)) {
          const alreadyConfirmedDates = type === 'sender' 
            ? fetchedOrder.pickupDate 
            : fetchedOrder.deliveryDate;
          
          if (alreadyConfirmedDates) {
            // Show a success message with the dates already confirmed
            let formattedDates = "Unknown dates";
            
            if (Array.isArray(alreadyConfirmedDates)) {
              formattedDates = alreadyConfirmedDates
                .map(date => format(new Date(date), "PPP"))
                .join(", ");
            } else if (alreadyConfirmedDates instanceof Date) {
              formattedDates = format(new Date(alreadyConfirmedDates), "PPP");
            } else if (typeof alreadyConfirmedDates === 'string') {
              try {
                formattedDates = format(new Date(alreadyConfirmedDates), "PPP");
              } catch (err) {
                console.error("Failed to format date string:", alreadyConfirmedDates);
              }
            }
            
            setError(`Your ${type === 'sender' ? 'pickup' : 'delivery'} dates (${formattedDates}) have already been confirmed.`);
          } else {
            setError(`Your ${type === 'sender' ? 'pickup' : 'delivery'} dates have already been confirmed.`);
          }
        }
        
        // Initialize notes from the order if available
        if (type === 'sender' && fetchedOrder.senderNotes) {
          setNotes(fetchedOrder.senderNotes);
        } else if (type === 'receiver' && fetchedOrder.receiverNotes) {
          setNotes(fetchedOrder.receiverNotes);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error loading order:", err);
        setError("Failed to load order details. Please try again later.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadOrder();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [id, type, isAlreadyConfirmed, hasAttemptedLoad]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!id) {
      setError("Order ID is missing");
      toast.error("Missing order identifier. Please try again with a valid link.");
      return;
    }

    if (dates.length < 5) {
      toast.error("Please select at least 5 dates when you'll be available");
      return;
    }

    try {
      setIsSubmitting(true);
      console.log(`Submitting ${type} availability for order: ${id}`);
      console.log("Selected dates:", dates.map(d => d.toISOString()));
      
      const updatedOrder = await updateFunction(id, dates, notes);

      if (updatedOrder) {
        toast.success("Your availability has been updated successfully!");
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        throw new Error(`Failed to update ${type} availability`);
      }
    } catch (err) {
      console.error(`Error updating ${type} availability:`, err);
      toast.error(`Failed to update your availability. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
