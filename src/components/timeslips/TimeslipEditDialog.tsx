import React, { useState } from 'react';
import { Timeslip } from '@/types/timeslip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

interface TimeslipEditDialogProps {
  timeslip: Timeslip | null;
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
    stop_hours: timeslip?.stop_hours || 0,
    lunch_hours: timeslip?.lunch_hours || 1,
    hourly_rate: timeslip?.hourly_rate || 11,
    van_allowance: timeslip?.van_allowance || 0,
    status: timeslip?.status || 'draft',
    admin_notes: timeslip?.admin_notes || '',
  });

  React.useEffect(() => {
    if (timeslip) {
      setFormData({
        driving_hours: timeslip.driving_hours,
        stop_hours: timeslip.stop_hours,
        lunch_hours: timeslip.lunch_hours,
        hourly_rate: timeslip.hourly_rate,
        van_allowance: timeslip.van_allowance,
        status: timeslip.status,
        admin_notes: timeslip.admin_notes || '',
      });
    }
  }, [timeslip]);

  const handleSave = () => {
    if (timeslip) {
      onSave(timeslip.id, formData);
      onClose();
    }
  };

  const totalHours = formData.driving_hours + formData.stop_hours + formData.lunch_hours;
  const totalPay = (totalHours * formData.hourly_rate) + formData.van_allowance;

  if (!timeslip) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit Timeslip - {timeslip.driver?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hours Section */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="driving_hours">Driving Hours</Label>
              <Input
                id="driving_hours"
                type="number"
                step="0.25"
                value={formData.driving_hours}
                onChange={(e) =>
                  setFormData({ ...formData, driving_hours: parseFloat(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="stop_hours">Stop Hours</Label>
              <Input
                id="stop_hours"
                type="number"
                step="0.25"
                value={formData.stop_hours}
                onChange={(e) =>
                  setFormData({ ...formData, stop_hours: parseFloat(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="lunch_hours">Lunch Hours</Label>
              <Input
                id="lunch_hours"
                type="number"
                step="0.25"
                value={formData.lunch_hours}
                onChange={(e) =>
                  setFormData({ ...formData, lunch_hours: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>

          {/* Pay Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) =>
                  setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })
                }
              />
            </div>
            <div>
              <Label htmlFor="van_allowance">Van Allowance (£)</Label>
              <Input
                id="van_allowance"
                type="number"
                step="0.01"
                value={formData.van_allowance}
                onChange={(e) =>
                  setFormData({ ...formData, van_allowance: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: 'draft' | 'approved' | 'rejected') =>
                setFormData({ ...formData, status: value })
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

          {/* Admin Notes */}
          <div>
            <Label htmlFor="admin_notes">Admin Notes</Label>
            <Textarea
              id="admin_notes"
              value={formData.admin_notes}
              onChange={(e) =>
                setFormData({ ...formData, admin_notes: e.target.value })
              }
              rows={3}
            />
          </div>

          {/* Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Hours:</span>
              <span className="font-medium">{totalHours.toFixed(2)}h</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>Total Pay:</span>
              <span>£{totalPay.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeslipEditDialog;
