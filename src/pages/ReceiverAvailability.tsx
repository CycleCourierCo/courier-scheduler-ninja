
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { updateReceiverAvailability } from '@/services/availabilityService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';
import { toast } from 'sonner';
import { getPublicOrder } from '@/services/fetchOrderService';

export default function ReceiverAvailability() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paramError, setParamError] = useState<string | null>(null);
  const [initialCheckCompleted, setInitialCheckCompleted] = useState(false);
  
  // Log the route params and domain info for debugging
  useEffect(() => {
    console.log("=== RECEIVER AVAILABILITY COMPONENT ===");
    console.log("Current domain:", window.location.origin);
    console.log("Full URL:", window.location.href);
    console.log("Route params:", params);
    console.log("ID param:", params.id);
    
    // Validate if ID param exists
    if (!params.id) {
      console.error("Missing ID parameter in the URL");
      setParamError("Missing order ID in the URL. Please check your link and try again.");
    } else {
      // Verify that the order exists directly (extra validation)
      getPublicOrder(params.id)
        .then(order => {
          if (!order) {
            console.error(`Order with ID ${params.id} not found`);
            setParamError(`Order with ID ${params.id} was not found. Please check your link and try again.`);
          }
          setInitialCheckCompleted(true);
        })
        .catch(err => {
          console.error("Error pre-fetching order:", err);
          setParamError("Error loading order information. Please try again later.");
          setInitialCheckCompleted(true);
        });
    }
  }, [params]);

  // The getMinDate function now just returns the current date as a fallback
  // The actual minimum date will be set in the useAvailability hook based on the sender's dates
  const {
    dates,
    setDates,
    notes,
    setNotes,
    isLoading,
    isSubmitting,
    order,
    error,
    minDate,
    navigate: hookNavigate,
    handleSubmit
  } = useAvailability({
    type: 'receiver',
    updateFunction: updateReceiverAvailability,
    getMinDate: () => new Date(), // This default will be overridden in the hook
    isAlreadyConfirmed: (order) => {
      if (!order) return false;
      return order.status === 'receiver_availability_confirmed' || 
             order.status === 'scheduled_dates_pending' ||
             order.status === 'pending_approval' || // Handle both status values
             order.status === 'scheduled' ||
             order.status === 'shipped' ||
             order.status === 'delivered';
    }
  });

  if (paramError) {
    return (
      <Layout>
        <ErrorState 
          error={paramError} 
          onHome={() => navigate("/")} 
        />
      </Layout>
    );
  }

  if (!initialCheckCompleted || isLoading) {
    return (
      <Layout>
        <LoadingState message="Loading order details..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorState 
          error={error} 
          onHome={() => navigate("/")} 
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <AvailabilityForm
        title="Confirm Your Availability"
        description="Select dates when you will be available for bicycle delivery"
        dates={dates}
        setDates={setDates}
        notes={notes}
        setNotes={setNotes}
        placeholder="Add any special instructions for delivery (optional)"
        minDate={minDate}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
