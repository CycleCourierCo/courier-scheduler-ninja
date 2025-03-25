
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { updateSenderAvailability } from '@/services/availabilityService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';
import { getPublicOrder } from '@/services/fetchOrderService';

export default function SenderAvailability() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paramError, setParamError] = useState<string | null>(null);
  const [initialCheckCompleted, setInitialCheckCompleted] = useState(false);
  
  // Log the route params and domain info for debugging
  useEffect(() => {
    console.log("=== SENDER AVAILABILITY COMPONENT ===");
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
    type: 'sender',
    updateFunction: updateSenderAvailability,
    getMinDate: () => new Date(), // Allow from current date
    isAlreadyConfirmed: (order) => {
      if (!order) return false;
      return (order.pickupDate !== undefined && order.pickupDate !== null) || 
             (order.status !== 'sender_availability_pending' && 
              order.status !== 'created');
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
        description="Select dates when you will be available for package pickup"
        dates={dates}
        setDates={setDates}
        notes={notes}
        setNotes={setNotes}
        placeholder="Add any special instructions for pickup (optional)"
        minDate={minDate}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
