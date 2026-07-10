import React, { useState } from 'react';
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

interface GenerateTimeslipsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (date: Date) => void;
}

const GenerateTimeslipsDialog: React.FC<GenerateTimeslipsDialogProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handleGenerate = () => {
    onGenerate(selectedDate);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Timeslips</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Select Date</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Choose the date to generate timeslips for all drivers with scheduled jobs
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
              This will create draft timeslips for all drivers who have jobs scheduled on{' '}
              <span className="font-medium text-foreground">
                {selectedDate.toLocaleDateString()}
              </span>
              . You can review and edit them before approval.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate}>Generate Timeslips</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateTimeslipsDialog;
