
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { SchedulingGroup } from "@/services/schedulingService";

interface SchedulingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGroup: SchedulingGroup | null;
  scheduleDate: Date | undefined;
  onScheduleDateChange: (date: Date | undefined) => void;
  onConfirmSchedule: () => void;
  isScheduling: boolean;
}

const SchedulingDialog: React.FC<SchedulingDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedGroup,
  scheduleDate,
  onScheduleDateChange,
  onConfirmSchedule,
  isScheduling
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Group</DialogTitle>
          <DialogDescription>
            Choose a date to schedule this order group.
          </DialogDescription>
        </DialogHeader>
        
        {selectedGroup && (
          <div className="py-4">
            <div className="mb-4">
              <h3 className="font-medium mb-2">Group Details</h3>
              <p>From: {selectedGroup.locationPair.from}</p>
              <p>To: {selectedGroup.locationPair.to}</p>
              <p>Orders: {selectedGroup.orders.length}</p>
            </div>
            
            <div className="mb-4">
              <h3 className="font-medium mb-2">Select Schedule Date</h3>
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={onScheduleDateChange}
                className="rounded-md border"
              />
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirmSchedule}
            disabled={!scheduleDate || isScheduling}
          >
            {isScheduling ? "Scheduling..." : "Confirm Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SchedulingDialog;
