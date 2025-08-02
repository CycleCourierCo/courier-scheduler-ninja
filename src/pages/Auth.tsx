
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();

  // Check for recovery tokens on mount and when URL changes
  useEffect(() => {
    const detectPasswordResetToken = () => {
      // Debug logs
      console.log("Auth component - checking for reset token");
      console.log("URL hash:", location.hash);
      console.log("URL search params:", location.search);
      console.log("Action param:", searchParams.get('action'));
      
      // Check explicit action parameter
      if (searchParams.get('action') === 'resetPassword') {
        console.log("Setting active tab to reset from action param");
        setActiveTab("reset");
        
        // Check for actual token in hash or search params
        const hasToken = 
          location.hash.includes('access_token=') || 
          location.hash.includes('type=recovery') ||
          location.search.includes('type=recovery');
          
        if (hasToken) {
          console.log("Found actual reset token, enabling reset password form");
          setIsResettingPassword(true);
        }
        
        return true;
      }
      
      // Check if hash contains reset token indicators
      if (location.hash && (
        location.hash.includes('access_token=') || 
        location.hash.includes('type=recovery')
      )) {
        console.log("Password reset token found in hash");
        setIsResettingPassword(true);
        setActiveTab("reset");
        toast.success("You can now set a new password");
        return true;
      }
      
      // Check if search params contain reset token indicators
      if (location.search && location.search.includes('type=recovery')) {
        console.log("Password reset token found in search params");
        setIsResettingPassword(true);
        setActiveTab("reset");
        toast.success("You can now set a new password");
        return true;
      }
      
      return false;
    };

    const hasResetToken = detectPasswordResetToken();
    console.log("Has reset token:", hasResetToken);
    
  }, [location, searchParams]);

  // Redirect logged in users to dashboard (unless they're resetting password)
  useEffect(() => {
    if (user && !isResettingPassword) {
      navigate("/dashboard");
    }
    // Clear reset state when user logs out
    if (!user && isResettingPassword) {
      setIsResettingPassword(false);
      setActiveTab("login");
    }
  }, [user, navigate, isResettingPassword]);

  // Handle isPasswordReset flag from AuthContext
  useEffect(() => {
    if (isPasswordReset) {
      console.log("isPasswordReset flag is true, showing reset form");
      setIsResettingPassword(true);
      setActiveTab("reset");
    }
  }, [isPasswordReset]);

  const handleForgotPassword = async (email: string) => {
    try {
      setForgotPasswordIsLoading(true);
      
      // Get the base URL of the site
      const origin = window.location.origin;
      // Create redirect URL that will be recognized by our app
      const redirectTo = `${origin}/auth?action=resetPassword`;
      
      console.log("Requesting password reset with redirect to:", redirectTo);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
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
      
      const { data: updateData, error } = await supabase.auth.updateUser({
        password: data.password
      });
      
      console.log("Password update response:", { updateData, error });
      
      if (error) throw error;
      
      toast.success("Password updated successfully!");
      
      setIsResettingPassword(false);
      setActiveTab("login");
      
      // Clear URL hash and params after successful password reset
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/auth');
      }
      
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Add a function to clear reset state when needed
  const clearResetState = () => {
    setIsResettingPassword(false);
    setActiveTab("login");
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/auth');
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

  console.log("Auth component state:", {
    activeTab,
    isResetEmailSent,
    isResettingPassword,
    hash: location.hash,
    search: location.search,
    isPasswordReset,
    currentPath: location.pathname
  });

  // Show current state in UI for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log("=== DEBUG INFO ===");
    console.log("Current path:", location.pathname);
    console.log("Current hash:", location.hash);
    console.log("Current search:", location.search);
    console.log("Active tab:", activeTab);
    console.log("Is resetting password:", isResettingPassword);
    console.log("Is password reset (from context):", isPasswordReset);
    console.log("Action param:", searchParams.get('action'));
  }

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
                {!isResettingPassword ? (
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                ) : (
                  <TabsList className="grid w-full grid-cols-1 mb-6">
                    <TabsTrigger value="reset">Reset Password</TabsTrigger>
                  </TabsList>
                )}

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
                    onBack={clearResetState}
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
