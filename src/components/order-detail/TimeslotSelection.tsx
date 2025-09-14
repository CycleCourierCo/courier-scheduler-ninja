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
  const [selectedTime, setSelectedTime] = useState<string>("18:00");
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

      // Then send the WhatsApp message
      const { error } = await supabase.functions.invoke('send-timeslot-whatsapp', {
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

      toast.success(`Timeslot sent to ${type} via WhatsApp successfully!`);
    } catch (error) {
      console.error("Error sending timeslot:", error);
      toast.error(`Failed to send timeslot: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };

  const contact = type === "sender" ? order?.sender : order?.receiver;
  const scheduledDate = type === "sender" ? order?.scheduledPickupDate : order?.scheduledDeliveryDate;

  if (!scheduledDate) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2" />
          {type === "sender" ? "Collection" : "Delivery"} Time Slot
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
              Send to {contact?.name} via WhatsApp
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