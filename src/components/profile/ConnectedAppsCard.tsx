import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Plug } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AppAddress {
  contact_name: string | null;
  contact_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  country: string | null;
}

interface ConnectedApp {
  grant_id: string;
  app_name: string;
  logo_url: string | null;
  connected_at: string;
  last_used_at: string | null;
  address: AppAddress | null;
}

type AddressForm = {
  contact_name: string;
  contact_phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
};

const emptyForm: AddressForm = {
  contact_name: "",
  contact_phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  county: "",
  postcode: "",
  country: "United Kingdom",
};

const formatAddress = (parts: Array<string | null | undefined>) =>
  parts.filter(part => part && part.trim().length > 0).join(", ");

/** Partner apps the signed-in customer has approved, with the address we collect from / deliver to. */
const ConnectedAppsCard: React.FC = () => {
  const { userProfile } = useAuth();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [editing, setEditing] = useState<ConnectedApp | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const profileAddress = {
    contact_name: userProfile?.company_name || userProfile?.name || "",
    contact_phone: userProfile?.phone || "",
    address_line_1: userProfile?.address_line_1 || "",
    address_line_2: userProfile?.address_line_2 || "",
    city: userProfile?.city || "",
    county: (userProfile as any)?.county || "",
    postcode: userProfile?.postal_code || "",
    country: (userProfile as any)?.country || "United Kingdom",
  };

  const load = async () => {
    const { data, error } = await supabase.rpc("get_my_connected_apps");
    if (!error) setApps((data ?? []) as unknown as ConnectedApp[]);
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

  const openEditor = (app: ConnectedApp) => {
    setEditing(app);
    setForm(
      app.address
        ? {
            contact_name: app.address.contact_name || "",
            contact_phone: app.address.contact_phone || "",
            address_line_1: app.address.address_line_1 || "",
            address_line_2: app.address.address_line_2 || "",
            city: app.address.city || "",
            county: app.address.county || "",
            postcode: app.address.postcode || "",
            country: app.address.country || "United Kingdom",
          }
        : { ...profileAddress }
    );
  };

  const saveAddress = async () => {
    if (!editing) return;
    if (!form.address_line_1.trim() || !form.city.trim() || !form.postcode.trim()) {
      toast.error("Address line 1, town or city and postcode are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_my_connected_app_address", {
      p_grant_id: editing.grant_id,
      p_address: form as unknown as Record<string, string>,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save this address");
      return;
    }
    toast.success(`Address saved for ${editing.app_name}`);
    setEditing(null);
    load();
  };

  const clearAddress = async (app: ConnectedApp) => {
    setSaving(true);
    const { error } = await supabase.rpc("set_my_connected_app_address", {
      p_grant_id: app.grant_id,
      p_address: null,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not switch back to your profile address");
      return;
    }
    toast.success(`${app.app_name} will use your profile address`);
    setEditing(null);
    load();
  };

  if (loading || apps.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Connected apps
          </CardTitle>
          <CardDescription>
            Other systems you have allowed to book and view orders on your account, and the address
            we use when collecting from or delivering to you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {apps.map(app => {
            const usesProfile = !app.address;
            const shown = app.address ?? {
              contact_name: profileAddress.contact_name,
              contact_phone: profileAddress.contact_phone,
              address_line_1: profileAddress.address_line_1,
              address_line_2: profileAddress.address_line_2,
              city: profileAddress.city,
              county: profileAddress.county,
              postcode: profileAddress.postcode,
              country: profileAddress.country,
            };
            const line = formatAddress([
              shown.address_line_1,
              shown.address_line_2,
              shown.city,
              shown.county,
              shown.postcode,
            ]);

            return (
              <div key={app.grant_id} className="rounded-md border p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
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

                <div className="rounded-md bg-muted/50 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {usesProfile ? "Using your profile address" : "Address for this app"}
                      </p>
                      <p className="text-muted-foreground break-words">
                        {line || "No address saved yet — add one below"}
                      </p>
                      {(shown.contact_name || shown.contact_phone) && (
                        <p className="text-xs text-muted-foreground break-words">
                          {formatAddress([shown.contact_name, shown.contact_phone])}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditor(app)}>
                      Change address
                    </Button>
                    {!usesProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearAddress(app)}
                        disabled={saving}
                      >
                        Use profile address
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Collection and delivery address</DialogTitle>
            <DialogDescription>
              Used when {editing?.app_name} books a job with you as the sender or the receiver.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cca-contact-name">Contact name</Label>
                <Input
                  id="cca-contact-name"
                  value={form.contact_name}
                  onChange={e => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cca-contact-phone">Contact phone</Label>
                <Input
                  id="cca-contact-phone"
                  value={form.contact_phone}
                  onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cca-line1">Address line 1</Label>
              <Input
                id="cca-line1"
                value={form.address_line_1}
                onChange={e => setForm({ ...form, address_line_1: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cca-line2">Address line 2</Label>
              <Input
                id="cca-line2"
                value={form.address_line_2}
                onChange={e => setForm({ ...form, address_line_2: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cca-city">Town or city</Label>
                <Input
                  id="cca-city"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cca-county">County</Label>
                <Input
                  id="cca-county"
                  value={form.county}
                  onChange={e => setForm({ ...form, county: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cca-postcode">Postcode</Label>
                <Input
                  id="cca-postcode"
                  value={form.postcode}
                  onChange={e => setForm({ ...form, postcode: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cca-country">Country</Label>
                <Input
                  id="cca-country"
                  value={form.country}
                  onChange={e => setForm({ ...form, country: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveAddress} disabled={saving}>
              {saving ? "Saving..." : "Save address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConnectedAppsCard;
