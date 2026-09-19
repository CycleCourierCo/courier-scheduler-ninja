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
import ChevronAlert from "@/components/design/ChevronAlert";

const PRIMARY_RESET_URL = "https://booking.cyclecourierco.com/reset-password";

// Safety net: if a (malformed) reset email link lands the user here with a
// recovery token in the URL, forward to /reset-password so the token is used.
const hasRecoveryToken = () => {
  if (typeof window === "undefined") return false;
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  return (
    search.includes("token_hash=") ||
    /[?&]type=recovery(?:&|$)/.test(search) ||
    hash.includes("access_token=") ||
    hash.includes("type=recovery")
  );
};

const Auth = () => {
  const [activeTab, setActiveTab] = useState("login");
  const [businessRegistrationComplete, setBusinessRegistrationComplete] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [isResetEmailSent, setIsResetEmailSent] = useState(false);
  const [forgotPasswordIsLoading, setForgotPasswordIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Run BEFORE the "user → /dashboard" effect so a stale session doesn't
  // shortcut us past the reset flow.
  useEffect(() => {
    if (hasRecoveryToken()) {
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      // Extract just the auth-relevant params; drop anything else like
      // ?action=resetPassword that may have been concatenated by a bad template.
      const incoming = new URLSearchParams(search.replace(/^\?/, ""));
      const forward = new URLSearchParams();
      const tokenHash = incoming.get("token_hash");
      const type = incoming.get("type") || "recovery";
      if (tokenHash) forward.set("token_hash", tokenHash);
      forward.set("type", type);
      const qs = forward.toString();
      navigate(`/reset-password${qs ? `?${qs}` : ""}${hash}`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (user && !hasRecoveryToken()) {
      // Partner app approvals send people here to sign in; return them to the
      // approval screen instead of the dashboard. Only same-site paths allowed.
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/oauth/authorize")) {
        navigate(next, { replace: true });
        return;
      }
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
      <div className="container mx-auto max-w-[420px] px-4 py-10">
        <Card>
          <CardHeader>
            <ChevronAlert className="mb-4">
              <p className="text-sm font-semibold leading-relaxed">
                Sending or receiving a bike as an individual? You don't need an account — use the link we emailed you.
              </p>
            </ChevronAlert>
            <CardTitle className="text-center">Log in or register</CardTitle>
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
