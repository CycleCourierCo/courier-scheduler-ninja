
import React from 'react';
import { isBefore, addDays } from "date-fns";
import Layout from '@/components/Layout';
import { updateSenderAvailability } from '@/services/orderService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';

export default function SenderAvailability() {
  const {
    dates,
    setDates,
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
    getMinDate: () => addDays(new Date(), 2), // Sender must be available at least 2 days from now
    isAlreadyConfirmed: (order) => {
      if (!order) return false;
      return (order.pickupDate !== undefined) || 
             (order.status !== 'sender_availability_pending' && 
              order.status !== 'created');
    }
  });

  if (isLoading) {
    return (
      <Layout>
        <LoadingState />
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
        description="Select dates when you will be available for package pickup (minimum 2 days from now)"
        dates={dates}
        setDates={setDates}
        minDate={minDate}
        isSubmitting={isSubmitting}
        disabledDate={(date) => isBefore(date, minDate)}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
