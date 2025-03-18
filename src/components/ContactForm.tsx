
import React from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Control } from "react-hook-form";

interface ContactFormProps {
  control: Control<any>;
  prefix: string;
}

const ContactForm: React.FC<ContactFormProps> = ({ control, prefix }) => {
  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name={`${prefix}.name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name *</FormLabel>
            <FormControl>
              <Input placeholder="John Doe" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${prefix}.email`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input placeholder="john.doe@example.com" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${prefix}.phone`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone *</FormLabel>
              <FormControl>
                <Input placeholder="+441234567890" type="tel" {...field} />
              </FormControl>
              <FormDescription>
                Must start with +44 for UK numbers
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default ContactForm;
