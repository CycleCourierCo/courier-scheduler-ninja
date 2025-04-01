
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Control } from "react-hook-form";
import { CreateOrderFormData } from "@/types/order";

interface DeliveryInstructionsProps {
  control: Control<CreateOrderFormData>;
}

const DeliveryInstructions: React.FC<DeliveryInstructionsProps> = ({ control }) => {
  return (
    <div className="w-full">
      <h3 className="text-lg font-medium mb-4">Delivery Instructions</h3>
      <FormField
        control={control}
        name="deliveryInstructions"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm sm:text-base">Special Instructions</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Please provide any special instructions for pickup or delivery"
                className="min-h-[80px] w-full resize-y text-sm"
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default DeliveryInstructions;
