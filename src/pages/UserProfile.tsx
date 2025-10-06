
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import DashboardHeader from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User, Building2, MapPin } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().min(4, "Phone number is required"),
  company_name: z.string().optional(),
  website: z.string().optional(),
  address_line_1: z.string().min(1, "Address line 1 is required"),
  address_line_2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  county: z.string().min(1, "County is required"),
  postal_code: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  accounts_email: z.string().email("Invalid email address").min(1, "Accounts email is required"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const UserProfile = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company_name: "",
      website: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      county: "",
      postal_code: "",
      country: "United Kingdom",
      accounts_email: "",
    },
  });

  // Set form values when user profile is loaded
  useEffect(() => {
    if (userProfile) {
      form.reset({
        name: userProfile.name || "",
        email: userProfile.email || "",
        phone: userProfile.phone || "",
        company_name: userProfile.company_name || "",
        website: userProfile.website || "",
        address_line_1: userProfile.address_line_1 || "",
        address_line_2: userProfile.address_line_2 || "",
        city: userProfile.city || "",
        county: userProfile.county || "",
        postal_code: userProfile.postal_code || "",
        country: userProfile.country || "United Kingdom",
        accounts_email: userProfile.accounts_email || "",
      });
    }
  }, [userProfile, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          phone: data.phone,
          company_name: data.company_name,
          website: data.website,
          address_line_1: data.address_line_1,
          address_line_2: data.address_line_2 || null,
          city: data.city,
          county: data.county,
          postal_code: data.postal_code,
          country: data.country,
          accounts_email: data.accounts_email,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      await refreshProfile();
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if form is valid
    const isValid = form.formState.isValid;
    const errors = form.formState.errors;
    
    if (Object.keys(errors).length > 0 || !isValid) {
      const errorCount = Object.keys(errors).length;
      toast.error(`Please fill in all required fields correctly (${errorCount} error${errorCount > 1 ? 's' : ''})`);
      return;
    }
    
    form.handleSubmit(onSubmit)(e);
  };

  return (
    <Layout>
      <div className="container px-4 py-6 md:px-6 mx-auto">
        <DashboardHeader>
          <div className="flex items-center">
            <User size={28} className="mr-2" />
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Your Profile</h2>
              <p className="text-muted-foreground">
                Manage your personal information and address
              </p>
            </div>
          </div>
        </DashboardHeader>
      </div>

      <div className="container px-4 py-6 md:px-6 max-w-4xl mx-auto">
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User size={18} />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
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
                          <Input type="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {userProfile?.is_business && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 size={18} />
                    Business Information
                  </CardTitle>
                  <CardDescription>
                    Your business details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company/Trading Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin size={18} />
                  Address Information
                </CardTitle>
                <CardDescription>
                  Your contact address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address_line_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1 *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address_line_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2 (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., West Midlands" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="accounts_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accounts Email (for invoicing) *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="accounts@company.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Layout>
  );
};

export default UserProfile;
