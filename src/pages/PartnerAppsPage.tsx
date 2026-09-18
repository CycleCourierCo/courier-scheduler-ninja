import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plug, Copy, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PartnerApp {
  id: string;
  client_id: string;
  secret_prefix: string;
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  redirect_uris: string[];
  is_active: boolean;
  created_at: string;
}

interface NewCredentials {
  name: string;
  client_id: string;
  client_secret: string;
}

const PartnerAppsPage: React.FC = () => {
  const [apps, setApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [credentials, setCredentials] = useState<NewCredentials | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("oauth_clients")
      .select("id, client_id, secret_prefix, name, logo_url, contact_email, redirect_uris, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load partner apps");
    } else {
      setApps((data ?? []) as PartnerApp[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy — ${label}: ${value}`);
    }
  };

  const handleCreate = async () => {
    const uris = redirectUris
      .split(/[\n,]/)
      .map(uri => uri.trim())
      .filter(Boolean);

    if (!name.trim() || uris.length === 0) {
      toast.error("Please enter the app name and at least one return web address");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("admin_create_oauth_client", {
      p_name: name.trim(),
      p_redirect_uris: uris,
      p_logo_url: logoUrl.trim() || null,
      p_contact_email: contactEmail.trim() || null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Could not register this app");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setCredentials({
      name: name.trim(),
      client_id: (row as { client_id: string }).client_id,
      client_secret: (row as { client_secret: string }).client_secret,
    });
    setName("");
    setRedirectUris("");
    setLogoUrl("");
    setContactEmail("");
    load();
  };

  const handleDeactivate = async (app: PartnerApp) => {
    const { error } = await supabase
      .from("oauth_clients")
      .update({ is_active: false })
      .eq("id", app.id);
    if (error) {
      toast.error("Could not switch this app off");
      return;
    }
    toast.success(`${app.name} can no longer connect new accounts`);
    load();
  };

  return (
    <Layout>
      <div className="container px-4 py-6 md:px-6 mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Plug size={28} />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Partner apps</h2>
            <p className="text-muted-foreground">
              Let other systems connect to a customer's account with their permission
            </p>
          </div>
        </div>

        {credentials && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Credentials for {credentials.name}</CardTitle>
              <CardDescription>
                Copy these now and send them to the partner securely — the secret is not shown again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>App ID</Label>
                <div className="flex gap-2">
                  <Input readOnly value={credentials.client_id} />
                  <Button variant="outline" size="icon" onClick={() => copy(credentials.client_id, "App ID")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>App secret</Label>
                <div className="flex gap-2">
                  <Input readOnly value={credentials.client_secret} />
                  <Button variant="outline" size="icon" onClick={() => copy(credentials.client_secret, "App secret")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={() => setCredentials(null)}>
                I've saved these
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Register a new app</CardTitle>
            <CardDescription>
              The return web addresses must match exactly what the partner uses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>App name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Velodealer" />
            </div>
            <div className="space-y-1">
              <Label>Return web addresses (one per line)</Label>
              <Textarea
                value={redirectUris}
                onChange={e => setRedirectUris(e.target.value)}
                placeholder="https://app.velodealer.com/callback"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Logo web address (optional)</Label>
                <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label>Contact email (optional)</Label>
                <Input
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="support@partner.com"
                  type="email"
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Registering..." : "Register app"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered apps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : apps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No apps registered yet.</p>
            ) : (
              apps.map(app => (
                <div key={app.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{app.name}</span>
                      {app.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Switched off</Badge>
                      )}
                    </div>
                    {app.is_active && (
                      <Button variant="outline" size="sm" onClick={() => handleDeactivate(app)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Switch off
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    App ID: {app.client_id} · Secret starts {app.secret_prefix}…
                  </p>
                  <p className="text-xs text-muted-foreground break-all">
                    Returns to: {app.redirect_uris.join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {format(new Date(app.created_at), "d MMM yyyy")}
                    {app.contact_email ? ` · ${app.contact_email}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PartnerAppsPage;
