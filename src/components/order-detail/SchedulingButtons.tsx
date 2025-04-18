
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import JobSchedulingForm from "@/components/scheduling/JobSchedulingForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createShipdayOrder } from '@/services/shipdayService';

interface SchedulingButtonsProps {
  orderId: string;
  onSchedule: () => void;
  onCreateShipment: () => void;
  onAdminSchedule: () => void;
  canSchedule: boolean;
  isSubmitting: boolean;
  isScheduled: boolean;
  pickupDateSelected: boolean;
  deliveryDateSelected: boolean;
  adminPickupDateSelected: boolean | undefined;
  adminDeliveryDateSelected: boolean | undefined;
  showAdminControls?: boolean;
  scheduledDates?: {
    pickup?: Date | null;
    delivery?: Date | null;
  };
  orderStatus?: string;
}

const SchedulingButtons: React.FC<SchedulingButtonsProps> = ({
  orderId,
  onSchedule,
  onCreateShipment,
  onAdminSchedule,
  isSubmitting,
  isScheduled,
  adminPickupDateSelected,
  adminDeliveryDateSelected,
  showAdminControls = false,
  scheduledDates,
  orderStatus,
}) => {
  const [localIsSubmitting, setLocalIsSubmitting] = useState(false);
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);

  // Check if pickup is ready to be scheduled
  const canSchedulePickup = !isScheduled && orderStatus !== 'collection_scheduled' && 
                          orderStatus !== 'driver_to_collection' && 
                          orderStatus !== 'collected';

  // Determine if delivery can be scheduled (only after pickup is done)
  const canScheduleDelivery = (orderStatus === 'collected') && !scheduledDates?.delivery;

  // Function to directly schedule collection without showing a form
  const handleDirectScheduleCollection = async () => {
    try {
      setLocalIsSubmitting(true);
      
      // Create a default date (today) and time (9:00 AM)
      const scheduleDateTime = new Date();
      scheduleDateTime.setHours(9, 0, 0, 0);
      
      // Update the order with the scheduled pickup date
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          scheduled_pickup_date: scheduleDateTime.toISOString(),
          status: 'collection_scheduled' as const
        })
        .eq('id', orderId);
        
      if (updateError) throw updateError;

      toast.success('Collection scheduled successfully');
      onSchedule(); // Refresh the parent component
    } catch (error) {
      console.error('Error scheduling collection:', error);
      toast.error('Failed to schedule collection');
    } finally {
      setLocalIsSubmitting(false);
    }
  };
  
  // Function to directly schedule delivery without showing a form
  const handleDirectScheduleDelivery = async () => {
    try {
      setLocalIsSubmitting(true);
      
      // Create a default date (today) and time (12:00 PM)
      const scheduleDateTime = new Date();
      scheduleDateTime.setHours(12, 0, 0, 0);
      
      // Update the order with the scheduled delivery date
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          scheduled_delivery_date: scheduleDateTime.toISOString(),
          status: 'delivery_scheduled' as const
        })
        .eq('id', orderId);
        
      if (updateError) throw updateError;

      toast.success('Delivery scheduled successfully');
      onSchedule(); // Refresh the parent component
    } catch (error) {
      console.error('Error scheduling delivery:', error);
      toast.error('Failed to schedule delivery');
    } finally {
      setLocalIsSubmitting(false);
    }
  };

  // Function to handle shipment creation for collection
  const handleCreateCollectionShipment = async () => {
    try {
      setLocalIsSubmitting(true);
      const shipdayResponse = await createShipdayOrder(orderId, 'pickup');
      
      if (shipdayResponse) {
        toast.success('Collection shipment created successfully');
      } else {
        toast.error('Failed to create collection shipment');
      }
    } catch (error) {
      console.error('Error creating collection shipment:', error);
      toast.error('Failed to create collection shipment');
    } finally {
      setLocalIsSubmitting(false);
    }
  };
  
  // Function to handle shipment creation for delivery
  const handleCreateDeliveryShipment = async () => {
    try {
      setLocalIsSubmitting(true);
      const shipdayResponse = await createShipdayOrder(orderId, 'delivery');
      
      if (shipdayResponse) {
        toast.success('Delivery shipment created successfully');
      } else {
        toast.error('Failed to create delivery shipment');
      }
    } catch (error) {
      console.error('Error creating delivery shipment:', error);
      toast.error('Failed to create delivery shipment');
    } finally {
      setLocalIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pickup scheduling section */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Collection Phase</h3>
        <Button 
          onClick={handleDirectScheduleCollection} 
          disabled={!canSchedulePickup || isSubmitting || localIsSubmitting}
          className="w-full"
          variant="default"
        >
          {(isSubmitting || localIsSubmitting) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Scheduling Collection...
            </>
          ) : (
            "Schedule Collection"
          )}
        </Button>
        
        <Button 
          onClick={handleCreateCollectionShipment} 
          disabled={!scheduledDates?.pickup || isSubmitting || localIsSubmitting}
          className="w-full"
          variant="secondary"
        >
          {(isSubmitting || localIsSubmitting) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Creating Collection Shipment...
            </>
          ) : (
            "Create Collection Shipment"
          )}
        </Button>
      </div>

      {/* Delivery scheduling section */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Delivery Phase</h3>
        <Button 
          onClick={handleDirectScheduleDelivery} 
          disabled={!canScheduleDelivery || isSubmitting || localIsSubmitting}
          className="w-full"
          variant="default"
        >
          {(isSubmitting || localIsSubmitting) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Scheduling Delivery...
            </>
          ) : (
            "Schedule Delivery"
          )}
        </Button>
        
        <Button 
          onClick={handleCreateDeliveryShipment} 
          disabled={!scheduledDates?.delivery || isSubmitting || localIsSubmitting}
          className="w-full"
          variant="secondary"
        >
          {(isSubmitting || localIsSubmitting) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
              Creating Delivery Shipment...
            </>
          ) : (
            "Create Delivery Shipment"
          )}
        </Button>
      </div>

      {/* Show admin scheduling controls if showAdminControls is true and order is not scheduled */}
      {showAdminControls && !isScheduled && (
        <div className="mt-6 border-t pt-4">
          <Button 
            onClick={onAdminSchedule} 
            disabled={!adminPickupDateSelected || !adminDeliveryDateSelected || isSubmitting || localIsSubmitting}
            className="w-full"
            variant="default"
          >
            {(isSubmitting || localIsSubmitting) ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Scheduling Order...
              </>
            ) : (
              "Admin: Schedule Order & Create Shipments"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SchedulingButtons;
