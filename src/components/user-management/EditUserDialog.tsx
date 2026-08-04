import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserProfile, UserRole, DEFAULT_OPENING_HOURS } from "@/types/user";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OpeningHoursEditor from "./OpeningHoursEditor";
import { listVehicles, type Vehicle } from "@/services/vehicleService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

interface EditUserDialogProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
  roles?: UserRole[];
}

export const EditUserDialog: React.FC<EditUserDialogProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
  roles,
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [creatingQbCustomer, setCreatingQbCustomer] = useState(false);

  useEffect(() => {
    listVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone,
        company_name: user.company_name,
        website: user.website,
        accounts_email: user.accounts_email,
        address_line_1: user.address_line_1,
        address_line_2: user.address_line_2,
        city: user.city,
        postal_code: user.postal_code,
        account_status: user.account_status,
        special_rate_code: user.special_rate_code,
        special_rate_price: user.special_rate_price,
        opening_hours: user.opening_hours || DEFAULT_OPENING_HOURS,
        is_test_account: user.is_test_account,
        hourly_rate: user.hourly_rate,
        uses_own_van: user.uses_own_van,
        van_allowance: user.van_allowance,
        is_active: user.is_active,
        available_hours: user.available_hours,
        shipday_driver_id: user.shipday_driver_id,
        shipday_driver_name: user.shipday_driver_name,
        default_vehicle_id: user.default_vehicle_id,
        quickbooks_customer_id: user.quickbooks_customer_id,
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      await onSave(user.id, formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const handleCreateQuickBooksCustomer = async () => {
    if (!user) return;
    const qbEmail = formData.accounts_email?.trim() || formData.email?.trim();
    if (!qbEmail) {
      toast.error('Profile must have an email or accounts email before syncing to QuickBooks');
      return;
    }
    setCreatingQbCustomer(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-quickbooks-customer', {
        body: { userId: user.id },
      });
      if (error) {
        // Extract structured `error` field from the edge function's JSON body.
        let bodyMsg: string | undefined;
        try {
          const ctx: any = (error as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const parsed = await ctx.json();
            if (parsed?.error) bodyMsg = String(parsed.error);
          }
        } catch { /* ignore */ }
        throw new Error(bodyMsg || error.message);
      }
      const customerId = (data as any)?.customerId;
      if (!customerId) throw new Error('No customer ID returned');
      setFormData(prev => ({ ...prev, quickbooks_customer_id: customerId }));
      toast.success(
        (data as any)?.alreadyExisted
          ? 'Linked existing QuickBooks customer'
          : 'Created customer in QuickBooks'
      );
    } catch (err: any) {
      console.error('Failed to create QB customer:', err);
      toast.error(err?.message || 'Failed to create QuickBooks customer');
    } finally {
      setCreatingQbCustomer(false);
    }
  };


  const isDriver = (roles?.includes('driver')) || user.role === 'driver';
  const isMechanic = (roles?.includes('mechanic')) || user.role === 'mechanic';
  const showPayTab = isDriver || isMechanic;
  const isBusiness = user.is_business;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
          <DialogDescription>
            Update user information and settings
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            {isBusiness && <TabsTrigger value="business">Business</TabsTrigger>}
            <TabsTrigger value="address">Address</TabsTrigger>
            {showPayTab && <TabsTrigger value="driver">{isDriver ? 'Driver' : 'Pay'}</TabsTrigger>}
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Account Status</Label>
                <Select 
                  value={formData.account_status || 'pending'} 
                  onValueChange={(value) => setFormData({ ...formData, account_status: value as any })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {isBusiness && (
            <TabsContent value="business" className="space-y-4 mt-4">
              <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">QuickBooks Customer</div>
                  <div className="text-xs text-muted-foreground">
                    {formData.quickbooks_customer_id
                      ? `Linked (ID: ${formData.quickbooks_customer_id})`
                      : 'Not linked to QuickBooks yet.'}
                  </div>
                </div>
                {formData.quickbooks_customer_id ? (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`https://app.qbo.intuit.com/app/customerdetail?nameId=${formData.quickbooks_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View in QuickBooks
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateQuickBooksCustomer}
                    disabled={creatingQbCustomer || !(formData.accounts_email?.trim() || formData.email?.trim())}
                    title={!(formData.accounts_email?.trim() || formData.email?.trim()) ? 'Email or accounts email required' : undefined}
                  >
                    {creatingQbCustomer ? 'Creating...' : 'Create customer in QuickBooks'}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="edit-company">Company Name</Label>
                  <Input
                    id="edit-company"
                    value={formData.company_name || ''}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-website">Website</Label>
                  <Input
                    id="edit-website"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-accounts-email">Accounts Email</Label>
                  <Input
                    id="edit-accounts-email"
                    type="email"
                    value={formData.accounts_email || ''}
                    onChange={(e) => setFormData({ ...formData, accounts_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-special-rate-code">Special Rate Code</Label>
                  <Input
                    id="edit-special-rate-code"
                    placeholder="e.g., CONTRACT-001"
                    value={formData.special_rate_code || ''}
                    onChange={(e) => setFormData({ ...formData, special_rate_code: e.target.value || null })}
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, all bikes will be invoiced using: "Collection and Delivery within England and Wales - Special Rate - {'{code}'}"
                  </p>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-special-rate-price">Special Rate Price (£ per delivery)</Label>
                  <Input
                    id="edit-special-rate-price"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 45.00"
                    value={formData.special_rate_price ?? ''}
                    onChange={(e) => setFormData({ ...formData, special_rate_price: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, this price per delivery will be used in profitability calculations instead of the standard bike-type pricing.
                  </p>
                </div>
                <div className="col-span-2">
                  <OpeningHoursEditor
                    value={formData.opening_hours || DEFAULT_OPENING_HOURS}
                    onChange={(hours) => setFormData({ ...formData, opening_hours: hours })}
                  />
                </div>
                <div className="col-span-2 flex items-center space-x-2 pt-2 border-t">
                  <Switch
                    id="edit-test-account"
                    checked={formData.is_test_account || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_test_account: checked })}
                  />
                  <div>
                    <Label htmlFor="edit-test-account">Test Account</Label>
                    <p className="text-xs text-muted-foreground">
                      Disables Shipday sync and email sending for this account
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="address" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-address1">Address Line 1</Label>
                <Input
                  id="edit-address1"
                  value={formData.address_line_1 || ''}
                  onChange={(e) => setFormData({ ...formData, address_line_1: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-address2">Address Line 2</Label>
                <Input
                  id="edit-address2"
                  value={formData.address_line_2 || ''}
                  onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-postal">Postal Code</Label>
                <Input
                  id="edit-postal"
                  value={formData.postal_code || ''}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          {isDriver && (
            <TabsContent value="driver" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-hourly-rate">Hourly Rate (£)</Label>
                  <Input
                    id="edit-hourly-rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-van-allowance">Van Allowance (£)</Label>
                  <Input
                    id="edit-van-allowance"
                    type="number"
                    step="0.01"
                    value={formData.van_allowance || ''}
                    onChange={(e) => setFormData({ ...formData, van_allowance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-available-hours">Available Hours/Day</Label>
                  <Input
                    id="edit-available-hours"
                    type="number"
                    value={formData.available_hours || ''}
                    onChange={(e) => setFormData({ ...formData, available_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-shipday-id">Shipday Driver ID</Label>
                  <Input
                    id="edit-shipday-id"
                    value={formData.shipday_driver_id || ''}
                    onChange={(e) => setFormData({ ...formData, shipday_driver_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-shipday-name">Shipday Driver Name</Label>
                  <Input
                    id="edit-shipday-name"
                    placeholder="e.g., Hass, Maj, Sal"
                    value={formData.shipday_driver_name || ''}
                    onChange={(e) => setFormData({ ...formData, shipday_driver_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-default-vehicle">Default Vehicle</Label>
                  <Select
                    value={formData.default_vehicle_id ?? 'none'}
                    onValueChange={(value) => setFormData({ ...formData, default_vehicle_id: value === 'none' ? null : value })}
                  >
                    <SelectTrigger id="edit-default-vehicle">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration}{v.make ? ` — ${v.make}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto-assigned to new timeslips generated for this driver.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-uses-van"
                    checked={formData.uses_own_van || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, uses_own_van: checked })}
                  />
                  <Label htmlFor="edit-uses-van">Uses Own Van</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-is-active"
                    checked={formData.is_active !== false}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="edit-is-active">Active</Label>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
