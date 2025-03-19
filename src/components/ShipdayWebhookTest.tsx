
import React from 'react';
import { Button } from "@/components/ui/button";
import { testShipdayWebhook } from "@/services/shipdayWebhookTest";
import { toast } from "sonner";

interface ShipdayWebhookTestProps {
  orderId: string;
}

export const ShipdayWebhookTest: React.FC<ShipdayWebhookTestProps> = ({ orderId }) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleTestWebhook = async (eventType: "ORDER_ASSIGNED" | "ORDER_ACCEPTED_AND_STARTED" | "ORDER_PIKEDUP" | "ORDER_COMPLETED" | "ORDER_FAILED") => {
    try {
      setIsLoading(true);
      await testShipdayWebhook(orderId, eventType);
      toast.success(`Test webhook sent: ${eventType}`);
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast.error("Failed to test webhook");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border p-4 rounded-md">
      <h3 className="text-lg font-semibold">Test Shipday Webhook</h3>
      <p className="text-sm text-muted-foreground">
        Send test webhook events to simulate Shipday delivery updates.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          disabled={isLoading}
          onClick={() => handleTestWebhook("ORDER_ASSIGNED")}
        >
          Test Assigned
        </Button>
        <Button 
          variant="outline" 
          disabled={isLoading}
          onClick={() => handleTestWebhook("ORDER_ACCEPTED_AND_STARTED")}
        >
          Test Started
        </Button>
        <Button 
          variant="outline" 
          disabled={isLoading}
          onClick={() => handleTestWebhook("ORDER_PIKEDUP")}
        >
          Test Pickup
        </Button>
        <Button 
          variant="outline" 
          disabled={isLoading}
          onClick={() => handleTestWebhook("ORDER_COMPLETED")}
        >
          Test Completed
        </Button>
        <Button 
          variant="outline" 
          disabled={isLoading}
          onClick={() => handleTestWebhook("ORDER_FAILED")}
        >
          Test Failed
        </Button>
      </div>
    </div>
  );
};
