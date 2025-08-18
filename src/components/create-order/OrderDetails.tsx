
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Control, useWatch } from "react-hook-form";
import { CreateOrderFormData } from "@/types/order";

interface OrderDetailsProps {
  control: Control<CreateOrderFormData>;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ control }) => {
  const bikeQuantity = useWatch({
    control,
    name: "bikeQuantity",
    defaultValue: 1,
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Bike Information</h3>
        
        <div className="mb-4">
          <FormField
            control={control}
            name="bikeQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Bikes *</FormLabel>
                <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue="1">
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select quantity" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? 'bike' : 'bikes'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          {Array.from({ length: bikeQuantity || 1 }, (_, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
              <FormField
                control={control}
                name={`bikes.${index}.brand` as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bike {index + 1} Brand *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Trek, Specialized" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`bikes.${index}.model` as any}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bike {index + 1} Model *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Domane SL5, Stumpjumper" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <FormField
            control={control}
            name="customerOrderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Order Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Order reference number if applicable" {...field} />
                </FormControl>
                <FormDescription>
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
