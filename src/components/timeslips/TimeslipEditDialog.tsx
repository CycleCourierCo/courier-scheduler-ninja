import React, { useState, useEffect } from 'react';
import { Timeslip, CustomAddon } from '@/types/timeslip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Plus } from 'lucide-react';

interface TimeslipEditDialogProps {
  timeslip: Timeslip;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Timeslip>) => void;
}

const TimeslipEditDialog: React.FC<TimeslipEditDialogProps> = ({
  timeslip,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    driving_hours: timeslip?.driving_hours || 6,
    total_stops: timeslip?.total_stops || 0,
    lunch_hours: timeslip?.lunch_hours || 1,
    hourly_rate: timeslip?.hourly_rate || 11,
    van_allowance: timeslip?.van_allowance || 0,
    status: timeslip?.status || 'draft',
    admin_notes: timeslip?.admin_notes || '',
    custom_addons: timeslip?.custom_addons || [],
  });

  const [newAddon, setNewAddon] = useState({ title: '', hours: 0 });

  useEffect(() => {
    if (timeslip) {
      setFormData({
        driving_hours: timeslip.driving_hours,
        total_stops: timeslip.total_stops,
        lunch_hours: timeslip.lunch_hours,
        hourly_rate: timeslip.hourly_rate,
        van_allowance: timeslip.van_allowance,
        status: timeslip.status,
        admin_notes: timeslip.admin_notes || '',
        custom_addons: timeslip.custom_addons || [],
      });
    }
  }, [timeslip]);

  const handleAddAddon = () => {
    if (newAddon.title.trim() && newAddon.hours > 0) {
      setFormData({
        ...formData,
        custom_addons: [...formData.custom_addons, { ...newAddon }]
      });
      setNewAddon({ title: '', hours: 0 });
    }
  };

  const handleRemoveAddon = (index: number) => {
    setFormData({
      ...formData,
      custom_addons: formData.custom_addons.filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
    const stop_hours = (formData.total_stops * 10) / 60;
    
    // Calculate total custom addon hours
    const customAddonHours = formData.custom_addons.reduce((sum, addon) => {
      const hours = isNaN(addon.hours) ? 0 : Number(addon.hours);
      return sum + hours;
    }, 0);
    
    onSave(timeslip.id, {
      ...formData,
      stop_hours,
      custom_addon_hours: customAddonHours,
    });
    onClose();
  };

  if (!timeslip) return null;

  const stop_hours = (formData.total_stops * 10) / 60;
  const customAddonHours = formData.custom_addons.reduce((sum, addon) => {
    const hours = isNaN(addon.hours) ? 0 : Number(addon.hours);
    return sum + hours;
  }, 0);
  const totalHours = formData.driving_hours + stop_hours + formData.lunch_hours + customAddonHours;
  const totalPay = (totalHours * formData.hourly_rate) + formData.van_allowance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Timeslip</DialogTitle>
          <DialogDescription>
            Update timeslip details for {timeslip.driver?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driving_hours">Driving Hours</Label>
              <Input
                id="driving_hours"
                type="number"
                step="0.5"
                value={formData.driving_hours}
                onChange={(e) => setFormData({ ...formData, driving_hours: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_stops">Number of Stops</Label>
              <Input
                id="total_stops"
                type="number"
                step="1"
                value={formData.total_stops}
                onChange={(e) => setFormData({ ...formData, total_stops: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">Stop hours: {stop_hours.toFixed(2)} (10 min per stop)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lunch_hours">Lunch Hours</Label>
              <Input
                id="lunch_hours"
                type="number"
                step="0.5"
                value={formData.lunch_hours}
                onChange={(e) => setFormData({ ...formData, lunch_hours: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.25"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="van_allowance">Van Allowance (£)</Label>
              <Input
                id="van_allowance"
                type="number"
                step="5"
                value={formData.van_allowance}
                onChange={(e) => setFormData({ ...formData, van_allowance: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as 'draft' | 'approved' | 'rejected' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Custom Add-Ons</Label>
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              {formData.custom_addons.length > 0 ? (
                <div className="space-y-1">
                  {formData.custom_addons.map((addon, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span>{addon.title}: {addon.hours}h</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAddon(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No custom add-ons</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input
                  placeholder="Title (e.g., Traffic)"
                  value={newAddon.title}
                  onChange={(e) => setNewAddon({ ...newAddon, title: e.target.value })}
                />
              </div>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Hours"
                  value={newAddon.hours === 0 ? '' : newAddon.hours}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setNewAddon({ ...newAddon, hours: isNaN(value) ? 0 : value });
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddAddon}
                  disabled={!newAddon.title.trim() || newAddon.hours <= 0}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_notes">Admin Notes</Label>
            <Textarea
              id="admin_notes"
              value={formData.admin_notes}
              onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-semibold">Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total Hours:</div>
              <div className="font-medium">{totalHours.toFixed(2)}h</div>
              <div>Total Pay:</div>
              <div className="font-medium text-primary">£{totalPay.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground col-span-2 space-y-1 mt-2 pt-2 border-t">
                <div>• Driving: {formData.driving_hours}h</div>
                <div>• Stops: {stop_hours.toFixed(2)}h</div>
                <div>• Lunch: +{formData.lunch_hours}h</div>
                {customAddonHours > 0 && (
                  <div>• Custom Add-ons: +{customAddonHours.toFixed(2)}h</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeslipEditDialog;
