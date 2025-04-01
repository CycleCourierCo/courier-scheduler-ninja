
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Control } from "react-hook-form";
import { CreateOrderFormData } from "@/types/order";
import { useIsMobile } from "@/hooks/use-mobile";

interface OrderDetailsProps {
  control: Control<CreateOrderFormData>;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ control }) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="space-y-6 w-full">
      <div>
        <h3 className="text-lg font-medium mb-4">Bike Information</h3>
        <div className="grid grid-cols-1 gap-4 w-full">
          <FormField
            control={control}
            name="bikeBrand"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Bike Brand *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Trek, Specialized" {...field} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="bikeModel"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Bike Model *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Domane SL5, Stumpjumper" {...field} className="w-full" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="mt-4 w-full">
          <FormField
            control={control}
            name="customerOrderNumber"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="text-sm">Customer Order Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Order reference number if applicable" {...field} className="w-full" />
                </FormControl>
                <FormDescription className="text-xs">
                  If you have an existing order number or reference, enter it here.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
