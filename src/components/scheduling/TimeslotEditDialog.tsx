import React, { useState } from "react";
import { Clock, Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SelectedJob {
  orderId: string;
  type: 'pickup' | 'delivery' | 'break';
  contactName: string;
  estimatedTime?: string;
  address: string;
  phoneNumber: string;
  order: any;
  orderData?: any;
  isGroupedLocation?: boolean;
  locationGroupId?: string;
}

interface TimeslotEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: SelectedJob | null;
  onConfirm: (job: SelectedJob, editedTime: string, selectedDate: Date) => void;
  isLoading?: boolean;
}

const TimeslotEditDialog: React.FC<TimeslotEditDialogProps> = ({
  open,
  onOpenChange,
  job,
  onConfirm,
  isLoading = false
}) => {
  const [editedTime, setEditedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  React.useEffect(() => {
    if (job) {
      setEditedTime(job.estimatedTime || "");
      setSelectedDate(undefined); // Reset date when job changes
    }
  }, [job]);

  const handleConfirm = () => {
    if (job && editedTime && selectedDate) {
      onConfirm(job, editedTime, selectedDate);
    }
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Edit Timeslot
          </DialogTitle>
          <DialogDescription>
            Review and edit the calculated time for {job.contactName} ({job.type === 'pickup' ? 'Collection' : 'Delivery'})
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date">
              Select Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">
              {job.type === 'pickup' ? 'Collection' : 'Delivery'} Time
            </Label>
            <Input
              id="time"
              type="time"
              value={editedTime}
              onChange={(e) => setEditedTime(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            Original calculated time: {job.estimatedTime}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !editedTime || !selectedDate}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending...
              </>
            ) : (
              "Send Timeslot"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeslotEditDialog;