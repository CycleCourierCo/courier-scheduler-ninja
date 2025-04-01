import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import { User, Building } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

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

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

const Auth = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [isBusinessAccount, setIsBusinessAccount] = useState(false);
  const [businessRegistrationComplete, setBusinessRegistrationComplete] = useState(false);
  const { signIn, signUp, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "+44",
      password: "",
      confirmPassword: "",
      is_business: false,
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

  useEffect(() => {
    registerForm.setValue("is_business", isBusinessAccount);
  }, [isBusinessAccount, registerForm]);

  const onLoginSubmit = async (data: LoginFormValues) => {
    try {
      await signIn(data.email, data.password);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    try {
      console.log("Starting registration process", data);
      console.log("Is business account:", data.is_business);
      
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

      console.log("User metadata:", metadata);
      
      const result = await signUp(data.email, data.password, data.name, metadata);
      
      console.log("Registration result:", result);
      
      if (data.is_business) {
        setBusinessRegistrationComplete(true);
        toast.success("Business account created. Your application is pending admin approval.");
      } else {
        toast.success("Account created successfully! You can now log in.");
        setActiveTab("login");
      }
      
      registerForm.reset();
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img src="/cycle-courier-logo.png" alt="Cycle Courier Company" className="h-10" />
            </div>
            <CardTitle className="text-2xl text-center">Courier Management</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            {businessRegistrationComplete ? (
              <div className="text-center space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
                  <h3 className="font-medium text-amber-800 mb-2">Business Account Registration Complete</h3>
                  <p className="text-amber-700">
                    Your business account application has been submitted successfully. An administrator will review your 
                    application and you'll receive an email when your account is approved.
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    setBusinessRegistrationComplete(false);
                    setActiveTab("login");
                  }} 
                  className="bg-courier-600 hover:bg-courier-700"
                >
                  Return to Login
                </Button>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
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
                        control={loginForm.control}
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
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign in"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="register">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium text-center">Account Type</h3>
                        <div className="flex flex-col items-center space-y-3">
                          <p className="text-sm text-muted-foreground text-center">Select your account type</p>
                          <div className="flex items-center justify-center w-full max-w-xs rounded-full bg-accent/30 p-1">
                            <button
                              type="button"
                              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-all w-1/2 ${
                                !isBusinessAccount ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
                              }`}
                              onClick={() => setIsBusinessAccount(false)}
                            >
                              <User size={16} />
                              <span>Personal</span>
                            </button>
                            <button
                              type="button"
                              className={`flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-all w-1/2 ${
                                isBusinessAccount ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
                              }`}
                              onClick={() => setIsBusinessAccount(true)}
                            >
                              <Building size={16} />
                              <span>Business</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={registerForm.control}
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
                            control={registerForm.control}
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
                            control={registerForm.control}
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

                        {isBusinessAccount && (
                          <div className="space-y-4 border p-4 rounded-md bg-accent/30">
                            <h3 className="font-medium">Business Information</h3>
                            <FormField
                              control={registerForm.control}
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
                              control={registerForm.control}
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
                        )}

                        <div className="space-y-4 border p-4 rounded-md bg-accent/30">
                          <h3 className="font-medium">Address Information</h3>
                          <FormField
                            control={registerForm.control}
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
                            control={registerForm.control}
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
                              control={registerForm.control}
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
                              control={registerForm.control}
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
                            control={registerForm.control}
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
                            control={registerForm.control}
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
                        disabled={isLoading}
                      >
                        {isLoading ? "Creating Account..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Auth;
