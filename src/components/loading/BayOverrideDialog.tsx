import { useCallback, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Ask "bay is occupied — override?" and resolve true/false. */
export function useBayOverrideConfirm() {
  const [state, setState] = useState<{ slot: string; occupant: string } | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const ask = useCallback((slot: string, occupant: string) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setState({ slot, occupant });
  }), []);

  const close = (v: boolean) => { resolver.current?.(v); resolver.current = undefined; setState(null); };

  const dialog = (
    <AlertDialog open={!!state} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bay {state?.slot} is already occupied</AlertDialogTitle>
          <AlertDialogDescription>
            The system shows <strong>{state?.occupant}</strong> in this bay. If it isn't physically there,
            override: that bike will be taken out of the bay and moved to "Wrongly allocated".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => close(true)}>Override bay</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { ask, dialog };
}
