
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import ResetEmailSent from "@/components/auth/ResetEmailSent";
import BusinessRegistrationComplete from "@/components/auth/BusinessRegistrationComplete";

const Auth = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [businessRegistrationComplete, setBusinessRegistrationComplete] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isResetEmailSent, setIsResetEmailSent] = useState(false);
  const [forgotPasswordIsLoading, setForgotPasswordIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const { isLoading, user, isPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if we're in a password reset flow
  useEffect(() => {
    const handlePasswordResetRedirect = async () => {
      // Check for hash fragment from Supabase redirects that contains the access token
      if (location.hash && 
          (location.hash.includes('type=recovery') || 
           location.hash.includes('access_token='))) {
        console.log("Password reset redirect detected from hash:", location.hash);
        setIsResettingPassword(true);
        setActiveTab("reset");
        
        toast.success("You can now set a new password");
      }
      // Also check query params for ?tab=reset
      else if (location.search.includes('tab=reset')) {
        setActiveTab("reset");
      }
    };

    handlePasswordResetRedirect();
  }, [location]);

  useEffect(() => {
    if (user && !isResettingPassword) {
      navigate("/dashboard");
    }
  }, [user, navigate, isResettingPassword]);

  // Update to handle auth status changes
  useEffect(() => {
    if (isPasswordReset) {
      setIsResettingPassword(true);
      setActiveTab("reset");
    }
  }, [isPasswordReset]);

  const handleForgotPassword = async (email: string) => {
    try {
      setForgotPasswordIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?tab=reset`,
      });
      
      if (error) {
        throw error;
      }
      
      setForgotPasswordEmail(email);
      setIsResetEmailSent(true);
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setForgotPasswordIsLoading(false);
    }
  };
  
  const handlePasswordReset = async (data: { password: string, confirmPassword: string }) => {
    try {
      setResetPasswordLoading(true);
      console.log("Attempting to update password...");
      
      // Using the updateUser method as per Supabase documentation
      const { data: updateData, error } = await supabase.auth.updateUser({
        password: data.password
      });
      
      console.log("Password update response:", { updateData, error });
      
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      
      // After successful password reset, redirect to login
      setIsResettingPassword(false);
      setActiveTab("login");
      
      // Clear hash from URL to prevent issues on refresh
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setResetPasswordLoading(false);
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

  // Debug the component state
  console.log("Auth component state:", {
    activeTab,
    isResetEmailSent,
    isResettingPassword,
    hash: location.hash,
    search: location.search
  });

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
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
                
                <TabsContent value="reset">
                  <ResetPasswordForm 
                    onSubmit={handlePasswordReset}
                    isLoading={resetPasswordLoading}
                  />
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
