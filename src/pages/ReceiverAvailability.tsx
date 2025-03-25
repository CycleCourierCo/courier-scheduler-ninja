
import React from 'react';
import Layout from '@/components/Layout';
import { updateReceiverAvailability } from '@/services/availabilityService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';

export default function ReceiverAvailability() {
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
    type: 'receiver',
    updateFunction: updateReceiverAvailability,
    getMinDate: () => new Date(), // Allow from current date
    isAlreadyConfirmed: (order) => {
      if (!order) return false;
      return order.status === 'receiver_availability_confirmed' || 
             order.status === 'pending_approval' ||
             order.status === 'scheduled' ||
             order.status === 'shipped' ||
             order.status === 'delivered';
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
        description="Select dates when you will be available for package delivery"
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
