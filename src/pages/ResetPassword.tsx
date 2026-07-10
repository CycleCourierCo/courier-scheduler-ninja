import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Loader2 } from "lucide-react";

type Status = "verifying" | "ready" | "expired" | "updating";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const tokenHash = searchParams.get("token_hash");
        const type = (searchParams.get("type") || "recovery") as "recovery";
        const hash = window.location.hash || "";

        // Preferred flow: token_hash from the email template.
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (cancelled) return;
          if (error) {
            setErrorMsg(error.message || "Link is invalid or has expired");
            setStatus("expired");
            return;
          }
          // Clean the URL
          window.history.replaceState(null, "", "/reset-password");
          setStatus("ready");
          return;
        }

        // Legacy fallback: implicit flow with #access_token=...&type=recovery.
        // detectSessionInUrl on the client will already have processed it.
        if (hash.includes("access_token=") || hash.includes("type=recovery")) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session) {
            window.history.replaceState(null, "", "/reset-password");
            setStatus("ready");
            return;
          }
        }

        // Last fallback: maybe the user already has a recovery session active.
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setStatus("ready");
        } else {
          setErrorMsg("Reset link is missing or has already been used");
          setStatus("expired");
        }
      } catch (err: any) {
        if (cancelled) return;
        setErrorMsg(err?.message || "Link is invalid or has expired");
        setStatus("expired");
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordReset = async (data: { password: string; confirmPassword: string }) => {
    try {
      setStatus("updating");
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;

      toast.success("Password updated successfully. Please sign in.");
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
      setStatus("ready");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Reset your password</CardTitle>
            <CardDescription className="text-center">
              {status === "ready" || status === "updating"
                ? "Choose a new password for your account"
                : status === "verifying"
                ? "Verifying your reset link..."
                : "We couldn't verify your reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "verifying" && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {(status === "ready" || status === "updating") && (
              <ResetPasswordForm
                onSubmit={handlePasswordReset}
                isLoading={status === "updating"}
                onBack={() => navigate("/auth", { replace: true })}
              />
            )}

            {status === "expired" && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {errorMsg ||
                    "This password reset link is invalid or has expired. Please request a new one."}
                </p>
                <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                  Request a new reset email
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ResetPassword;
