import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { User, Building } from "lucide-react";
import { toast } from "sonner";

const addressSchema = z.object({
  address_line_1: z.string().min(1, "Address line 1 is required"),
  address_line_2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postal_code: z.string().min(1, "Postal code is required"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(3, "+44 followed by at least 10 digits").default("+44"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
  is_business: z.boolean().default(false),
  company_name: z.string().optional(),
  website: z.string().optional(),
  address: addressSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine(
  (data) => !data.is_business || data.company_name, {
    message: "Company name is required for business accounts",
    path: ["company_name"],
  }
);

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccessfulRegistration: (isBusinessAccount: boolean) => void;
}

const RegisterForm = ({ onSuccessfulRegistration }: RegisterFormProps) => {
  const { signUp, isLoading } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "+44",
      password: "",
      confirmPassword: "",
      is_business: true,
      company_name: "",
      website: "",
      address: {
        address_line_1: "",
        address_line_2: "",
        city: "",
        postal_code: "",
      }
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      setLocalLoading(true);
      
      const metadata = {
        name: data.name,
        is_business: data.is_business.toString(),
        company_name: data.company_name || null,
        website: data.website || null,
        phone: data.phone,
        address_line_1: data.address.address_line_1,
        address_line_2: data.address.address_line_2 || null,
        city: data.address.city,
        postal_code: data.address.postal_code
      };

      
      
      await signUp(data.email, data.password, data.name, metadata);
      
      onSuccessfulRegistration(data.is_business);
      form.reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to register. Please try again.");
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-center">Business Registration</h3>
          <div className="flex flex-col items-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Building size={16} />
              <span className="text-sm">Business Account</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
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
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 border p-4 rounded-md bg-accent/30">
            <h3 className="font-medium">Business Information</h3>
            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company/Trading Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Company Ltd or Trading Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 border p-4 rounded-md bg-accent/30">
            <h3 className="font-medium">Address Information</h3>
            <FormField
              control={form.control}
              name="address.address_line_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1 *</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address.address_line_2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apt 4B" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="London" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address.postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="SW1A 1AA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-courier-600 hover:bg-courier-700" 
          disabled={isLoading || localLoading}
        >
          {isLoading || localLoading ? "Creating Account..." : "Create Account"}
        </Button>
      </form>
    </Form>
  );
};

export default RegisterForm;
