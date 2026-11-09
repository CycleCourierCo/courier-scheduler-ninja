import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import AssigneePicker from '@/components/tasks/AssigneePicker';
import { supabase } from '@/integrations/supabase/client';
import type { UserProfile } from '@/types/user';

interface GenerateTimeslipsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (date: Date, driverId?: string) => void;
}

const ALL_DRIVERS = 'all';

const GenerateTimeslipsDialog: React.FC<GenerateTimeslipsDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [driverId, setDriverId] = useState<string>(ALL_DRIVERS);

  useEffect(() => {
    if (isOpen) setDriverId(ALL_DRIVERS);
  }, [isOpen]);

  // Same list (and cache) as the "Create timeslip" popup
  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .or('is_active.is.null,is_active.eq.true').or('account_status.is.null,account_status.not.in.(suspended,rejected)')
        .order('name');
      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: isOpen,
  });

  const driverOptions = drivers.map((d) => ({ id: d.id, name: d.name ?? null, email: d.email ?? null }));
  const chosenDriver = driverId === ALL_DRIVERS ? undefined : driverOptions.find((d) => d.id === driverId);
  const forWho = chosenDriver ? chosenDriver.name || chosenDriver.email || 'this driver' : 'all drivers';

  const handleGenerate = () => {
    onGenerate(selectedDate, chosenDriver?.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Timeslips</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <div className="space-y-2">
            <Label htmlFor="generate-driver">Driver</Label>
            <AssigneePicker
              id="generate-driver"
              value={driverId}
              onChange={setDriverId}
              users={driverOptions}
              fixedOptions={[{ value: ALL_DRIVERS, label: 'All drivers' }]}
              ariaLabel="Driver to generate timeslips for"
            />
          </div>

          <div>
            <Label>Select Date</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Choose the date to generate timeslips for
            </p>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              This will create a draft timeslip for{' '}
              <span className="font-medium text-foreground">{forWho}</span> with completed jobs on{' '}
              <span className="font-medium text-foreground">
                {selectedDate.toLocaleDateString()}
              </span>
              . Approved timeslips are never changed. You can review and edit drafts before approval.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate}>
            {chosenDriver ? 'Generate for driver' : 'Generate Timeslips'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateTimeslipsDialog;
