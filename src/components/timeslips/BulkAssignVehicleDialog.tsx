import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { listVehicles } from '@/services/vehicleService';
import { timeslipService } from '@/services/timeslipService';
import { UserProfile } from '@/types/user';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BulkAssignVehicleDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .eq('is_active', true)
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

  const canPreview = driverId && dateFrom && dateTo;

  useEffect(() => {
    if (!canPreview) {
      setPreviewCount(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    (async () => {
      let query = supabase
        .from('timeslips')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', driverId)
        .gte('date', format(dateFrom!, 'yyyy-MM-dd'))
        .lte('date', format(dateTo!, 'yyyy-MM-dd'));
      if (onlyEmpty) query = query.is('vehicle_id', null);
      const { count, error } = await query;
      if (cancelled) return;
      setLoadingPreview(false);
      if (error) {
        setPreviewCount(null);
        return;
      }
      setPreviewCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, dateFrom, dateTo, onlyEmpty, canPreview]);

  const reset = () => {
    setDriverId('');
    setVehicleId('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setOnlyEmpty(true);
    setPreviewCount(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!driverId || !vehicleId || !dateFrom || !dateTo) return;
    setSubmitting(true);
    try {
      const count = await timeslipService.bulkAssignVehicle({
        driverId,
        vehicleId,
        dateFrom: format(dateFrom, 'yyyy-MM-dd'),
        dateTo: format(dateTo, 'yyyy-MM-dd'),
        onlyEmpty,
      });
      toast.success(`Assigned vehicle to ${count} timeslip${count !== 1 ? 's' : ''}`);
      onSuccess();
      reset();
      onClose();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Assign Vehicle</DialogTitle>
          <DialogDescription>
            Assign one vehicle to all of a driver's timeslips in a date range.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name || d.email || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateFrom ? format(dateFrom, 'PPP') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateTo ? format(dateTo, 'PPP') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    disabled={(date) => (dateFrom ? date < dateFrom : false)}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <Truck className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {activeVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registration}
                    {v.make ? ` — ${v.make}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label>Only fill empty</Label>
              <p className="text-xs text-muted-foreground">
                Skip timeslips that already have a vehicle assigned.
              </p>
            </div>
            <Switch checked={onlyEmpty} onCheckedChange={setOnlyEmpty} />
          </div>

          <div className="p-3 rounded-md bg-muted text-sm">
            {!canPreview ? (
              <span className="text-muted-foreground">Pick a driver and date range to preview.</span>
            ) : loadingPreview ? (
              <span className="text-muted-foreground">Counting matching timeslips…</span>
            ) : (
              <span>
                <strong>{previewCount ?? 0}</strong> timeslip
                {previewCount === 1 ? '' : 's'} will be updated.
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || !driverId || !vehicleId || !dateFrom || !dateTo || !previewCount
            }
          >
            {submitting ? 'Assigning…' : 'Assign Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAssignVehicleDialog;
