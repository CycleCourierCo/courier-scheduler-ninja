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
import { OpeningHours, DAY_NAMES } from "@/types/user";

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

interface AdminComment {
  admin_name: string;
  comment: string;
  created_at: string;
}

interface TimeslotEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: SelectedJob | null;
  onConfirm: (job: SelectedJob, editedTime: string, selectedDate: Date) => void;
  isLoading?: boolean;
  adminComments?: AdminComment[];
  openingHours?: OpeningHours;
}

const getDayKeyFromDate = (date: Date): keyof OpeningHours => {
  const days: (keyof OpeningHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

const TimeslotEditDialog: React.FC<TimeslotEditDialogProps> = ({
  open,
  onOpenChange,
  job,
  onConfirm,
  isLoading = false,
  adminComments = [],
  openingHours
}) => {
  const [editedTime, setEditedTime] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  React.useEffect(() => {
    if (job) {
      setEditedTime(job.estimatedTime || "");
      setSelectedDate(undefined);
    }
  }, [job]);

  const handleConfirm = () => {
    if (job && editedTime && selectedDate) {
      onConfirm(job, editedTime, selectedDate);
    }
  };

  const deliveryInstructions = job?.orderData?.delivery_instructions || job?.order?.deliveryInstructions || null;
  const senderNotes = job?.orderData?.sender_notes || job?.order?.senderNotes || null;
  const receiverNotes = job?.orderData?.receiver_notes || job?.order?.receiverNotes || null;

  // Get opening hours for the selected date
  const selectedDayHours = selectedDate && openingHours ? openingHours[getDayKeyFromDate(selectedDate)] : null;

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

          {/* Opening Hours for selected date */}
          {selectedDate && openingHours && (
            <div className="space-y-1">
              <Label>Opening Hours ({format(selectedDate, "EEEE")})</Label>
              {selectedDayHours ? (
                selectedDayHours.open ? (
                  <div className="text-sm bg-muted p-2 rounded-md">
                    {selectedDayHours.is24h ? '🕐 Open 24 hours' : `🕐 ${selectedDayHours.start} - ${selectedDayHours.end}`}
                  </div>
                ) : (
                  <div className="text-sm bg-destructive/10 text-destructive p-2 rounded-md">
                    ⚠️ Closed on {format(selectedDate, "EEEE")}
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* Show compact opening hours summary when no date selected */}
          {!selectedDate && openingHours && (
            <div className="space-y-1">
              <Label>Opening Hours</Label>
              <div className="text-xs bg-muted p-2 rounded-md space-y-0.5">
                {DAY_NAMES.filter(day => day !== 'friday').map(day => {
                  const d = openingHours[day];
                  return (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize font-medium">{day.slice(0, 3)}</span>
                      <span className="text-muted-foreground">
                        {d.open ? (d.is24h ? '24h' : `${d.start} - ${d.end}`) : 'Closed'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
          
          {deliveryInstructions && (
            <div className="space-y-1">
              <Label>Delivery Instructions</Label>
              <div className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">{deliveryInstructions}</div>
            </div>
          )}

          {job.type === 'pickup' && senderNotes && (
            <div className="space-y-1">
              <Label>Sender Notes</Label>
              <div className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">{senderNotes}</div>
            </div>
          )}

          {job.type === 'delivery' && receiverNotes && (
            <div className="space-y-1">
              <Label>Receiver Notes</Label>
              <div className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">{receiverNotes}</div>
            </div>
          )}

          {adminComments.length > 0 && (
            <div className="space-y-1">
              <Label>Admin Notes</Label>
              <div className="space-y-1">
                {adminComments.map((c, i) => (
                  <div key={i} className="text-sm bg-muted p-2 rounded-md whitespace-pre-wrap">
                    <span className="font-medium">{c.admin_name}:</span> {c.comment}
                  </div>
                ))}
              </div>
            </div>
          )}

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