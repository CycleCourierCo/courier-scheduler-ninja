import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageLabel: string;
  targetLabel: string;
  onConfirm: (reason: string) => void;
}

const ServiceOverrideDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  stageLabel,
  targetLabel,
  onConfirm,
}) => {
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Override the service gate?</AlertDialogTitle>
          <AlertDialogDescription>
            This bike's workshop service isn't finished ({stageLabel}). Moving it to
            "{targetLabel}" will be recorded against the order with your name and the
            reason below.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is it safe to pack this bike now?"
          rows={3}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={reason.trim().length < 5}
            onClick={() => onConfirm(reason.trim())}
          >
            Override and advance
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ServiceOverrideDialog;
