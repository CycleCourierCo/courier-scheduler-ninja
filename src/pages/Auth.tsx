import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import ResetEmailSent from "@/components/auth/ResetEmailSent";
import BusinessRegistrationComplete from "@/components/auth/BusinessRegistrationComplete";

const PRIMARY_RESET_URL = "https://booking.cyclecourierco.com/reset-password";

const Auth = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [businessRegistrationComplete, setBusinessRegistrationComplete] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isResetEmailSent, setIsResetEmailSent] = useState(false);
  const [forgotPasswordIsLoading, setForgotPasswordIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleForgotPassword = async (email: string) => {
    try {
      setForgotPasswordIsLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: PRIMARY_RESET_URL,
      });

      if (error) throw error;

      setForgotPasswordEmail(email);
      setIsResetEmailSent(true);
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setForgotPasswordIsLoading(false);
    }
  };

  const handleSuccessfulRegistration = (isBusinessAccount: boolean) => {
    if (isBusinessAccount) {
      setBusinessRegistrationComplete(true);
      toast.success("Business account created. Your application is pending admin approval.");
    } else {
      toast.success("Account created successfully! You can now log in.");
      setActiveTab("login");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm font-bold text-center text-destructive leading-relaxed">
                DO NOT REGISTER UNLESS YOU ARE A BICYCLE BUSINESS. IF YOU ARE EXPECTING A COLLECTION OR DELIVERY PLEASE GO TO THE TRACKING PAGE OR CONTACT US FOR FURTHER INFO
              </p>
            </div>
            <CardTitle className="text-2xl text-center">Log in or Register</CardTitle>
            <CardDescription className="text-center">
              Sign in to access your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            {businessRegistrationComplete ? (
              <BusinessRegistrationComplete
                onReturnToLogin={() => {
                  setBusinessRegistrationComplete(false);
                  setActiveTab("login");
                }}
              />
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  {isResetEmailSent ? (
                    <ResetEmailSent
                      email={forgotPasswordEmail}
                      onBack={() => setIsResetEmailSent(false)}
                    />
                  ) : (
                    <LoginForm onForgotPassword={handleForgotPassword} />
                  )}
                </TabsContent>

                <TabsContent value="register">
                  <RegisterForm onSuccessfulRegistration={handleSuccessfulRegistration} />
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
