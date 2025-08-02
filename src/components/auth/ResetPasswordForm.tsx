
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { KeyRound } from "lucide-react";

// Password strength validation
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  onSubmit: (data: ResetPasswordFormValues) => Promise<void>;
  isLoading: boolean;
  onBack?: () => void;
}

const ResetPasswordForm = ({ onSubmit, isLoading, onBack }: ResetPasswordFormProps) => {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  console.log("ResetPasswordForm rendered");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center mb-4">
        <div className="bg-courier-50 p-3 rounded-full">
          <KeyRound className="h-6 w-6 text-courier-600" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-center">Reset Your Password</h3>
      <p className="text-sm text-center text-muted-foreground mb-4">
        Please enter a new password for your account
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
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
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full bg-courier-600 hover:bg-courier-700" 
            disabled={isLoading}
          >
            {isLoading ? "Updating Password..." : "Update Password"}
          </Button>
          
          {onBack && (
            <Button 
              type="button" 
              variant="outline"
              className="w-full" 
              onClick={onBack}
              disabled={isLoading}
            >
              Back to Login
            </Button>
          )}
        </form>
      </Form>
    </div>
  );
};

export default ResetPasswordForm;
