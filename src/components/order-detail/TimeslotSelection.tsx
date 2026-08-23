import React, { useState } from "react";
import { Clock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatTimeslotWindow } from "@/utils/timeslotUtils";
import EmailDeliveryStatus from "./EmailDeliveryStatus";

interface TimeslotSelectionProps {
  type: "sender" | "receiver";
  orderId: string;
  order: any;
}

const TimeslotSelection: React.FC<TimeslotSelectionProps> = ({ type, orderId, order }) => {
  const existingTimeslot = type === "sender" ? order?.pickupTimeslot : order?.deliveryTimeslot;
  const [selectedTime, setSelectedTime] = useState<string>(existingTimeslot || "18:00");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);


  const handleSendWhatsApp = async () => {
    if (!selectedTime) {
      toast.error("Please select a delivery time");
      return;
    }

    try {
      setIsSendingWhatsApp(true);

      // Save the timeslot to the database
      const updateField = type === "sender" ? "pickup_timeslot" : "delivery_timeslot";
      const { error: updateError } = await supabase
        .from('orders')
        .update({ [updateField]: selectedTime })
        .eq('id', orderId);

      if (updateError) {
        toast.error(`Failed to save timeslot: ${updateError.message}`);
        return;
      }

      // Determine and update status
      let newStatus = order.status;
      if (type === "sender") {
        newStatus = "collection_scheduled";
      } else if (type === "receiver") {
        const pickupDate = order?.scheduledPickupDate;
        const deliveryDate = order?.scheduledDeliveryDate;
        if (pickupDate && deliveryDate) {
          const pickupDateOnly = new Date(pickupDate).toDateString();
          const deliveryDateOnly = new Date(deliveryDate).toDateString();
          newStatus = pickupDateOnly === deliveryDateOnly ? "scheduled" : "delivery_scheduled";
        } else {
          newStatus = "delivery_scheduled";
        }
      }

      await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      // Send the WhatsApp message
      const messageType = type === "sender" ? "collection_timeslots" : "delivery_timeslot";
      const { data, error } = await supabase.functions.invoke('send-sendzen-whatsapp', {
        body: {
          orderId,
          type: messageType,
          recipientType: type,
          deliveryTime: selectedTime
        }
      });

      if (error) {
        toast.error(`WhatsApp failed: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success(`Timeslot sent via WhatsApp to ${type}!`);
      } else {
        toast.error(`WhatsApp failed: ${data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSendingWhatsApp(false);
    }
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
        <CardTitle className="flex items-center justify-between text-sm gap-2">
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            {currentTimeslot ? "Update" : "Set"} {type === "sender" ? "Collection" : "Delivery"} Time Slot
          </span>
          <EmailDeliveryStatus orderId={orderId} side={type} emailType="timeslot" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${type}-time`}>
            Arrival time (start of 3-hour window)
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
          onClick={handleSendWhatsApp}
          disabled={isSendingWhatsApp || !contact?.phone}
          className="w-full"
          size="sm"
        >
          {isSendingWhatsApp ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending...
            </>
          ) : (
            <>
              <MessageSquare className="w-4 h-4 mr-2" />
              Send Timeslot (WhatsApp)
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