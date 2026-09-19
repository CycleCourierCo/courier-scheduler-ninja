import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Signboard from "@/components/design/Signboard";

interface ClientInfo {
  valid: boolean;
  error?: string;
  name?: string;
  logo_url?: string | null;
  contact_email?: string | null;
}

/**
 * Approval screen for partner apps ("Connect with Cycle Courier").
 * The partner sends the customer here with the standard OAuth query parameters;
 * on approval we mint a single-use code and bounce back to their redirect URI.
 */
const OAuthAuthorizePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const params = useMemo(() => ({
    clientId: searchParams.get("client_id") ?? "",
    redirectUri: searchParams.get("redirect_uri") ?? "",
    state: searchParams.get("state") ?? "",
    codeChallenge: searchParams.get("code_challenge") ?? "",
    codeChallengeMethod: searchParams.get("code_challenge_method") ?? "S256",
    responseType: searchParams.get("response_type") ?? "code",
  }), [searchParams]);

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Send unauthenticated visitors to sign in, then straight back here.
  useEffect(() => {
    if (authLoading || user) return;
    const next = `${window.location.pathname}${window.location.search}`;
    navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!params.clientId || !params.redirectUri) {
        setFailure("This link is incomplete. Please start again from the other app.");
        setLoading(false);
        return;
      }
      if (params.responseType !== "code" || !params.codeChallenge) {
        setFailure("This link is not valid. Please start again from the other app.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_oauth_client_public", {
        p_client_id: params.clientId,
        p_redirect_uri: params.redirectUri,
      });

      if (error) {
        setFailure("We could not check this request. Please try again shortly.");
      } else {
        const info = data as unknown as ClientInfo;
        if (!info?.valid) {
          setFailure(
            info?.error === "invalid_redirect_uri"
              ? "That app's return address is not registered with us. Please contact the app provider."
              : "We do not recognise the app making this request."
          );
        } else {
          setClient(info);
        }
      }
      setLoading(false);
    };

    if (user) load();
  }, [user, params]);

  const returnToPartner = (extra: Record<string, string>) => {
    const target = new URL(params.redirectUri);
    Object.entries(extra).forEach(([key, value]) => target.searchParams.set(key, value));
    if (params.state) target.searchParams.set("state", params.state);
    window.location.replace(target.toString());
  };

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke("oauth-authorize", {
        body: {
          client_id: params.clientId,
          redirect_uri: params.redirectUri,
          code_challenge: params.codeChallenge,
          code_challenge_method: params.codeChallengeMethod,
        },
      });

      if (error || !data?.code) {
        setFailure("We could not complete the connection. Please try again.");
        setSubmitting(false);
        return;
      }

      returnToPartner({ code: data.code as string });
    } catch {
      setFailure("We could not complete the connection. Please try again.");
      setSubmitting(false);
    }
  };

  const handleDeny = () => {
    if (params.redirectUri) {
      returnToPartner({ error: "access_denied" });
      return;
    }
    navigate("/dashboard");
  };

  if (authLoading || (!user && !failure) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="doorstep-page flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <Signboard title="Connect your account" className="rounded-none" />
        {failure ? (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Something's not right
              </CardTitle>
              <CardDescription>{failure}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
                Back to my account
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-3">
              {client?.logo_url && (
                <img
                  src={client.logo_url}
                  alt={`${client.name} logo`}
                  className="h-12 w-12 rounded-md object-contain"
                />
              )}
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Connect {client?.name}
              </CardTitle>
              <CardDescription>
                {client?.name} is asking to use your Cycle Courier account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-2">
                <p className="font-medium">If you allow this, {client?.name} will be able to:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Book collections and deliveries on your account</li>
                  <li>See the orders and tracking on your account</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                Signed in as {user?.email}. You can remove this connection at any time from your
                profile. {client?.contact_email ? `Questions? ${client.contact_email}` : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleDeny} disabled={submitting}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleApprove} disabled={submitting}>
                  {submitting ? "Connecting..." : "Allow"}
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default OAuthAuthorizePage;
