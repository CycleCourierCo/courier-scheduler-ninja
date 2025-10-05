
import React from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Control } from "react-hook-form";

interface ContactFormProps {
  control: Control<any>;
  prefix: string;
}

const ContactForm: React.FC<ContactFormProps> = ({ control, prefix }) => {
  // Function to ensure +44 prefix is preserved but not duplicated
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    let value = e.target.value;
    
    // If the value doesn't already start with +44, add it
    // But first remove any existing +44 to prevent duplication
    if (value.startsWith('+44')) {
      value = value.substring(3);
    }
    
    onChange('+44' + value);
  };

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
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Phone *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="1234567890" 
                  type="tel" 
                  value={field.value} 
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className={fieldState.error ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </FormControl>
              <FormMessage className="text-destructive font-medium" />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default ContactForm;
