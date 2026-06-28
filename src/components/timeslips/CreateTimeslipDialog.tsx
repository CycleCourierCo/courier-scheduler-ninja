import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { listVehicles } from '@/services/vehicleService';
import { UserProfile } from '@/types/user';
import { CustomAddon } from '@/types/timeslip';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export interface CreateTimeslipInput {
  driver_id: string;
  date: string;
  status: 'draft' | 'approved' | 'rejected';
  driving_hours: number;
  total_stops: number;
  stop_hours: number;
  lunch_hours: number;
  hourly_rate: number;
  van_allowance: number;
  mileage: number | null;
  vehicle_id: string | null;
  custom_addons: CustomAddon[];
  custom_addon_hours: number;
  admin_notes: string | null;
  route_links: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateTimeslipInput) => void;
  submitting?: boolean;
}

const defaultForm = () => ({
  driver_id: '',
  date: new Date(),
  status: 'draft' as 'draft' | 'approved' | 'rejected',
  driving_hours: 6,
  total_stops: 0,
  lunch_hours: 1,
  hourly_rate: 11,
  van_allowance: 0,
  mileage: null as number | null,
  vehicle_id: null as string | null,
  admin_notes: '',
  custom_addons: [] as CustomAddon[],
});

const CreateTimeslipDialog: React.FC<Props> = ({ isOpen, onClose, onCreate, submitting }) => {
  const [form, setForm] = useState(defaultForm());
  const [newAddon, setNewAddon] = useState({ title: '', hours: 0 });

  useEffect(() => {
    if (isOpen) {
      setForm(defaultForm());
      setNewAddon({ title: '', hours: 0 });
    }
  }, [isOpen]);

  const { data: drivers } = useQuery({
    queryKey: ['drivers-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .order('name');
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-active'],
    queryFn: listVehicles,
  });
  const activeVehicles = vehicles.filter(
    (v) => v.status !== 'sold' && v.status !== 'written_off'
  );

  // Auto-set mileage to 160 when van allowance is added
  useEffect(() => {
    if (form.van_allowance > 0 && !form.mileage) {
      setForm((p) => ({ ...p, mileage: 160 }));
    }
  }, [form.van_allowance]);

  const stop_hours = (form.total_stops * 10) / 60;
  const customAddonHours = form.custom_addons.reduce(
    (sum, a) => sum + (isNaN(a.hours) ? 0 : Number(a.hours)),
    0
  );
  const totalHours = form.driving_hours + stop_hours + form.lunch_hours + customAddonHours;
  const totalPay = totalHours * form.hourly_rate + form.van_allowance;

  const canSubmit = !!form.driver_id && !!form.date && !submitting;

  const handleAddAddon = () => {
    if (newAddon.title.trim() && newAddon.hours > 0) {
      setForm({ ...form, custom_addons: [...form.custom_addons, { ...newAddon }] });
      setNewAddon({ title: '', hours: 0 });
    }
  };

  const handleRemoveAddon = (index: number) => {
    setForm({ ...form, custom_addons: form.custom_addons.filter((_, i) => i !== index) });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onCreate({
      driver_id: form.driver_id,
      date: format(form.date, 'yyyy-MM-dd'),
      status: form.status,
      driving_hours: form.driving_hours,
      total_stops: form.total_stops,
      stop_hours,
      lunch_hours: form.lunch_hours,
      hourly_rate: form.hourly_rate,
      van_allowance: form.van_allowance,
      mileage: form.mileage,
      vehicle_id: form.vehicle_id,
      custom_addons: form.custom_addons,
      custom_addon_hours: customAddonHours,
      admin_notes: form.admin_notes?.trim() ? form.admin_notes.trim() : null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Timeslip</DialogTitle>
          <DialogDescription>
            Manually add a timeslip for a driver. All fields can be edited later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Driver *</Label>
              <Select
                value={form.driver_id}
                onValueChange={(v) => setForm({ ...form, driver_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name || d.email || 'Unknown'}
                      {d.is_active === false && (
                        <span className="ml-1 text-xs text-muted-foreground">(disabled)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {form.date ? format(form.date, 'PPP') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date}
                    onSelect={(d) => d && setForm({ ...form, date: d })}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Driving Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={form.driving_hours}
                onChange={(e) =>
                  setForm({ ...form, driving_hours: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Stops</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={form.total_stops}
                onChange={(e) =>
                  setForm({ ...form, total_stops: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Stop hours: {stop_hours.toFixed(2)} (10 min/stop)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Lunch Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={form.lunch_hours}
                onChange={(e) =>
                  setForm({ ...form, lunch_hours: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hourly Rate (£)</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={form.hourly_rate}
                onChange={(e) =>
                  setForm({ ...form, hourly_rate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Van Allowance (£)</Label>
              <Input
                type="number"
                step="5"
                min="0"
                value={form.van_allowance}
                onChange={(e) =>
                  setForm({ ...form, van_allowance: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Mileage (miles)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="Auto-set to 160 if van allowance"
                value={form.mileage ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mileage: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <Select
                value={form.vehicle_id ?? 'none'}
                onValueChange={(v) =>
                  setForm({ ...form, vehicle_id: v === 'none' ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {activeVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.registration}
                      {v.make ? ` — ${v.make}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm({ ...form, status: v as 'draft' | 'approved' | 'rejected' })
              }
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
              {form.custom_addons.length > 0 ? (
                <div className="space-y-1">
                  {form.custom_addons.map((addon, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {addon.title}: {addon.hours}h
                      </span>
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
            <Label>Admin Notes</Label>
            <Textarea
              value={form.admin_notes}
              onChange={(e) => setForm({ ...form, admin_notes: e.target.value })}
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
                <div>• Driving: {form.driving_hours}h</div>
                <div>• Stops: {stop_hours.toFixed(2)}h</div>
                <div>• Lunch: +{form.lunch_hours}h</div>
                {customAddonHours > 0 && (
                  <div>• Custom Add-ons: +{customAddonHours.toFixed(2)}h</div>
                )}
                {form.van_allowance > 0 && (
                  <div>• Van Allowance: +£{form.van_allowance.toFixed(2)}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Creating…' : 'Create Timeslip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTimeslipDialog;
