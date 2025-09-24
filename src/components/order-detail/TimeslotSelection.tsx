import React, { useState } from "react";
import { Clock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TimeslotSelectionProps {
  type: "sender" | "receiver";
  orderId: string;
  order: any;
}

const TimeslotSelection: React.FC<TimeslotSelectionProps> = ({ type, orderId, order }) => {
  const existingTimeslot = type === "sender" ? order?.pickupTimeslot : order?.deliveryTimeslot;
  const [selectedTime, setSelectedTime] = useState<string>(existingTimeslot || "18:00");
  const [isSending, setIsSending] = useState(false);

  const handleSendTimeslot = async () => {
    if (!selectedTime) {
      toast.error("Please select a delivery time");
      return;
    }

    try {
      setIsSending(true);
      
      // First save the timeslot to the database
      const updateField = type === "sender" ? "pickup_timeslot" : "delivery_timeslot";
      const { error: updateError } = await supabase
        .from('orders')
        .update({ [updateField]: selectedTime })
        .eq('id', orderId);

      if (updateError) {
        console.error("Error saving timeslot:", updateError);
        toast.error(`Failed to save timeslot: ${updateError.message}`);
        return;
      }

      // Determine the new status based on timeslot type and dates
      let newStatus = order.status;
      if (type === "sender") {
        newStatus = "collection_scheduled";
      } else if (type === "receiver") {
        // Check if delivery is on same date as collection
        const pickupDate = order?.scheduledPickupDate;
        const deliveryDate = order?.scheduledDeliveryDate;
        
        if (pickupDate && deliveryDate) {
          const pickupDateOnly = new Date(pickupDate).toDateString();
          const deliveryDateOnly = new Date(deliveryDate).toDateString();
          
          if (pickupDateOnly === deliveryDateOnly) {
            newStatus = "scheduled";
          } else {
            newStatus = "delivery_scheduled";
          }
        } else {
          newStatus = "delivery_scheduled";
        }
      }

      // Update the order status
      const { error: statusUpdateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (statusUpdateError) {
        console.error("Error updating order status:", statusUpdateError);
        toast.error(`Failed to update order status: ${statusUpdateError.message}`);
        return;
      }

      // Then send the WhatsApp message
      const { data, error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
        body: {
          orderId,
          recipientType: type,
          deliveryTime: selectedTime
        }
      });

      if (error) {
        console.error("Error sending timeslot:", error);
        toast.error(`Failed to send timeslot: ${error.message}`);
        return;
      }

      // Check Shipday status and show appropriate notification
      if (data?.shipdayStatus === 'failed') {
        toast.success(`Timeslot sent to ${type} via WhatsApp successfully!`, {
          description: `Note: Shipday update failed (${data.shipdayError}). The timeslot was saved but may need manual update in Shipday.`
        });
      } else if (data?.shipdayStatus === 'no_shipday_id') {
        toast.success(`Timeslot sent to ${type} via WhatsApp successfully!`, {
          description: "Note: No Shipday order found to update."
        });
      } else {
        toast.success(`Timeslot sent to ${type} via WhatsApp successfully!`);
      }
    } catch (error) {
      console.error("Error sending timeslot:", error);
      toast.error(`Failed to send timeslot: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };

  // Format timeslot as 3-hour window
  const formatTimeslotWindow = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const startHour = Math.max(0, hours - 3);
    const startTime = `${startHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const endTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return `${startTime} to ${endTime}`;
  };

  const contact = type === "sender" ? order?.sender : order?.receiver;
  const scheduledDate = type === "sender" ? order?.scheduledPickupDate : order?.scheduledDeliveryDate;
  const currentTimeslot = type === "sender" ? order?.pickupTimeslot : order?.deliveryTimeslot;

  if (!scheduledDate) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2" />
          {currentTimeslot ? "Update" : "Set"} {type === "sender" ? "Collection" : "Delivery"} Time Slot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${type}-time`}>
            Latest {type === "sender" ? "collection" : "delivery"} time
          </Label>
          <Input
            id={`${type}-time`}
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full"
          />
        </div>
        
        <Button 
          onClick={handleSendTimeslot}
          disabled={isSending || !contact?.phone}
          className="w-full"
          size="sm"
        >
          {isSending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Timeslot
            </>
          )}
        </Button>
        
        {!contact?.phone && (
          <p className="text-sm text-muted-foreground">
            No phone number available for {type}
          </p>
        )}
        </CardContent>
      </Card>
  );
};

export default TimeslotSelection;