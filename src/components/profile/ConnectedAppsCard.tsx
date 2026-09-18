import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ConnectedApp {
  grant_id: string;
  app_name: string;
  logo_url: string | null;
  connected_at: string;
  last_used_at: string | null;
}

/** Partner apps the signed-in customer has approved, with a way to revoke them. */
const ConnectedAppsCard: React.FC = () => {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_my_connected_apps");
    if (!error) setApps((data ?? []) as ConnectedApp[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = async (grantId: string, name: string) => {
    setRevoking(grantId);
    const { error } = await supabase.rpc("revoke_oauth_grant", { p_grant_id: grantId });
    setRevoking(null);
    if (error) {
      toast.error(`Could not disconnect ${name}`);
      return;
    }
    toast.success(`${name} has been disconnected`);
    setApps(prev => prev.filter(app => app.grant_id !== grantId));
  };

  if (loading || apps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Connected apps
        </CardTitle>
        <CardDescription>
          Other systems you have allowed to book and view orders on your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {apps.map(app => (
          <div
            key={app.grant_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {app.logo_url && (
                <img src={app.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{app.app_name}</p>
                <p className="text-xs text-muted-foreground">
                  Connected {format(new Date(app.connected_at), "d MMM yyyy")}
                  {app.last_used_at
                    ? ` · last used ${format(new Date(app.last_used_at), "d MMM yyyy")}`
                    : " · not used yet"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRevoke(app.grant_id, app.app_name)}
              disabled={revoking === app.grant_id}
            >
              {revoking === app.grant_id ? "Removing..." : "Disconnect"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ConnectedAppsCard;
