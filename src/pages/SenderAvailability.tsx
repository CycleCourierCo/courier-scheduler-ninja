
import React from 'react';
import Layout from '@/components/Layout';
import { updateSenderAvailability } from '@/services/availabilityService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';

export default function SenderAvailability() {
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
    navigate,
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

  if (isLoading) {
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
