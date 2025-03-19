
import React from 'react';
import { isBefore, addDays } from "date-fns";
import Layout from '@/components/Layout';
import { updateReceiverAvailability } from '@/services/orderService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';

export default function ReceiverAvailability() {
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
    type: 'receiver',
    updateFunction: updateReceiverAvailability,
    getMinDate: (order) => {
      // Calculate minimum date based on pickup date
      if (order?.pickupDate) {
        if (Array.isArray(order.pickupDate) && order.pickupDate.length > 0) {
          // Find the earliest pickup date and add one day to it
          const earliestDate = new Date(Math.min(...order.pickupDate.map(d => d.getTime())));
          return addDays(earliestDate, 1); // Add one day to the earliest pickup date
        } else if (!Array.isArray(order.pickupDate)) {
          // Add one day to the pickup date
          return addDays(order.pickupDate, 1);
        }
      }
      // Default to 2 days from now if no pickup date is set
      return addDays(new Date(), 2);
    },
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
        description="Select dates when you will be available for package delivery (must be at least one day after the sender's availability)"
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
