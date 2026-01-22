
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onForgotPassword: (email: string) => void;
}

const LoginForm = ({ onForgotPassword }: LoginFormProps) => {
  const { signIn, isLoading: authLoading } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);
  const [forgotPasswordIsLoading, setForgotPasswordIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Reset local loading state when auth context loading state changes
  useEffect(() => {
    if (!authLoading) {
      setLocalLoading(false);
    }
  }, [authLoading]);

  // Safety timeout - if stuck loading for more than 5 seconds, reset
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (localLoading || authLoading) {
      timeout = setTimeout(() => {
        if (localLoading) {
          setLocalLoading(false);
          toast.error("Sign in is taking too long. Please try again.");
        }
      }, 5000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [localLoading, authLoading]);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setLocalLoading(true);
      await signIn(data.email, data.password);
    } catch (error) {
      setLocalLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const email = form.getValues("email");
    
    if (!email) {
      toast.error("Please enter your email address first");
      return;
    }
    
    setForgotPasswordIsLoading(true);
    onForgotPassword(email);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
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
          disabled={localLoading || authLoading}
        >
          {localLoading || authLoading ? "Signing in..." : "Sign in"}
        </Button>
        
        <div className="text-center mt-2">
          <button
            onClick={handleForgotPassword}
            className="text-sm text-courier-600 hover:text-courier-700 hover:underline"
            disabled={forgotPasswordIsLoading}
          >
            {forgotPasswordIsLoading ? "Sending..." : "Forgot your password?"}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;
