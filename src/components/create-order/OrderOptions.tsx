
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Control, useWatch } from "react-hook-form";
import { CreateOrderFormData } from "@/types/order";

interface OrderOptionsProps {
  control: Control<CreateOrderFormData>;
}

const OrderOptions: React.FC<OrderOptionsProps> = ({ control }) => {
  const needsPaymentOnCollection = useWatch({
    control,
    name: "needsPaymentOnCollection",
  });

  const isEbayOrder = useWatch({
    control,
    name: "isEbayOrder",
  });

  const isBikeSwap = useWatch({
    control,
    name: "isBikeSwap",
  });

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Order Options</h3>
      <div className="space-y-4">
        <FormField
          control={control}
          name="isEbayOrder"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  eBay Order
                </FormLabel>
                <FormDescription>
                  Toggle if this is an eBay order requiring a collection code.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {isEbayOrder && (
          <FormField
            control={control}
            name="collectionCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collection Code *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter eBay collection code" {...field} />
                </FormControl>
                <FormDescription>
                  This code will be added to the delivery instructions for the driver.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={control}
          name="needsPaymentOnCollection"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Payment Required on Collection
                </FormLabel>
                <FormDescription>
                  Toggle if payment needs to be collected when the bike is picked up.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {needsPaymentOnCollection && (
          <FormField
            control={control}
            name="paymentCollectionPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Collection Phone Number *</FormLabel>
                <FormControl>
                  <Input placeholder="+44XXXXXXXXXX" {...field} />
                </FormControl>
                <FormDescription>
                  Phone number for the driver to call to process payment on collection.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={control}
          name="isBikeSwap"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Part Exchange
                </FormLabel>
                <FormDescription>
                  Toggle if this order is a part exchange (collecting a bike and delivering another back).
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {isBikeSwap && (
          <FormField
            control={control}
            name="partExchangeBikeModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Part Exchange Bike Model *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter the bike model to be part exchanged" {...field} />
                </FormControl>
                <FormDescription>
                  The bike model that will be collected from the receiver and delivered back to the sender.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default OrderOptions;
