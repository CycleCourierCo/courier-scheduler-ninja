import { useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getRoles } from "@/lib/roles";
import { isScanStaff, parseScannedRef } from "@/lib/labelScan";
import StaffScanPanel from "./StaffScanPanel";

/** Staff bike card popup, opened by ?scan=<CCC ref> on any staff page. Never shown on public tracking. */
export default function StaffScanDialog() {
  const [params, setParams] = useSearchParams();
  const { userProfile } = useAuth() as any;
  const ref = parseScannedRef(params.get("scan") ?? "");
  if (!ref || !isScanStaff(getRoles(userProfile))) return null;
  const close = () => { const next = new URLSearchParams(params); next.delete("scan"); setParams(next, { replace: true }); };
  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Scanned label · {ref}</DialogTitle></DialogHeader>
        <StaffScanPanel key={ref} reference={ref} />
      </DialogContent>
    </Dialog>
  );
}
