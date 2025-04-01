
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
    <div>
      <h3 className="text-lg font-medium mb-4">Order Options</h3>
      <div className="space-y-4">
        <FormField
          control={control}
          name="needsPaymentOnCollection"
          render={({ field }) => (
            <FormItem className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center justify-between'} rounded-lg border p-4`}>
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Payment Required on Collection
                </FormLabel>
                <FormDescription className="text-xs md:text-sm">
                  Toggle if payment needs to be collected when the bike is picked up.
                </FormDescription>
              </div>
              <FormControl>
                <div className={`${isMobile ? 'mt-2' : ''}`}>
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
            <FormItem className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center justify-between'} rounded-lg border p-4`}>
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Bike Swap
                </FormLabel>
                <FormDescription className="text-xs md:text-sm">
                  Toggle if this order is a bike swap (exchanging one bike for another).
                </FormDescription>
              </div>
              <FormControl>
                <div className={`${isMobile ? 'mt-2' : ''}`}>
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
