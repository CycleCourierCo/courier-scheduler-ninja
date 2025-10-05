
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
          render={({ field, fieldState }) => {
            const normalizePhone = (value: string) => {
              // Strip all spaces and whitespace
              let cleaned = value.replace(/\s/g, '');
              
              // Handle various formats of pasted numbers
              // Convert 0044 to +44
              if (cleaned.startsWith('0044')) {
                cleaned = '+44' + cleaned.substring(4);
              }
              // Convert UK numbers starting with 0 to +44
              else if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
                cleaned = '+44' + cleaned.substring(1);
              }
              // Ensure +44 prefix if it's just digits
              else if (!cleaned.startsWith('+') && /^\d+$/.test(cleaned)) {
                cleaned = '+44' + cleaned;
              }
              
              // Remove any non-digit characters except the leading +
              const hasPlus = cleaned.startsWith('+');
              cleaned = cleaned.replace(/[^\d]/g, '');
              if (hasPlus) {
                cleaned = '+' + cleaned;
              }
              
              return cleaned;
            };

            return (
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="1234567890" 
                    type="tel"
                    inputMode="numeric"
                    value={field.value || ''}
                    onChange={(e) => {
                      const normalized = normalizePhone(e.target.value);
                      field.onChange(normalized);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pastedText = e.clipboardData.getData('text');
                      const normalized = normalizePhone(pastedText);
                      field.onChange(normalized);
                      // Trigger validation after paste
                      setTimeout(() => field.onBlur(), 100);
                    }}
                    onBlur={field.onBlur}
                    className={fieldState.error ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                </FormControl>
                <FormMessage className="text-destructive font-medium" />
              </FormItem>
            );
          }}
        />
      </div>
    </div>
  );
};

export default ContactForm;
