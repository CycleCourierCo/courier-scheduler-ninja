import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserProfile } from "@/types/user";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EditUserDialogProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, updates: Partial<UserProfile>) => Promise<void>;
}

export const EditUserDialog: React.FC<EditUserDialogProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);

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
        hourly_rate: user.hourly_rate,
        uses_own_van: user.uses_own_van,
        van_allowance: user.van_allowance,
        is_active: user.is_active,
        available_hours: user.available_hours,
        shipday_driver_id: user.shipday_driver_id,
        shipday_driver_name: user.shipday_driver_name,
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

  const isDriver = user.role === 'driver';
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            {isBusiness && <TabsTrigger value="business">Business</TabsTrigger>}
            <TabsTrigger value="address">Address</TabsTrigger>
            {isDriver && <TabsTrigger value="driver">Driver</TabsTrigger>}
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
