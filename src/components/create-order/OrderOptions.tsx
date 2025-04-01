
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Control } from "react-hook-form";
import { CreateOrderFormData } from "@/types/order";
import { useIsMobile } from "@/hooks/use-mobile";

interface OrderOptionsProps {
  control: Control<CreateOrderFormData>;
}

const OrderOptions: React.FC<OrderOptionsProps> = ({ control }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="w-full">
      <h3 className="text-lg font-medium mb-4">Order Options</h3>
      <div className="space-y-4 w-full">
        <FormField
          control={control}
          name="needsPaymentOnCollection"
          render={({ field }) => (
            <FormItem className="flex flex-col rounded-lg border p-4 w-full">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Payment Required on Collection
                </FormLabel>
                <FormDescription className="text-xs">
                  Toggle if payment needs to be collected when the bike is picked up.
                </FormDescription>
              </div>
              <FormControl>
                <div className="mt-2 self-start">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="isBikeSwap"
          render={({ field }) => (
            <FormItem className="flex flex-col rounded-lg border p-4 w-full">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Bike Swap
                </FormLabel>
                <FormDescription className="text-xs">
                  Toggle if this order is a bike swap (exchanging one bike for another).
                </FormDescription>
              </div>
              <FormControl>
                <div className="mt-2 self-start">
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default OrderOptions;
