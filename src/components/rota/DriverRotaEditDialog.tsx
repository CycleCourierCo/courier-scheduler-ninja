import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DriverAvailabilityTab } from "@/components/user-management/DriverAvailabilityTab";
import { UnavailableDatesEditor } from "@/components/rota/UnavailableDatesEditor";

interface Props {
  driver: { id: string; name?: string | null; email?: string | null } | null;
  onOpenChange: (o: boolean) => void;
}

export const DriverRotaEditDialog = ({ driver, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { userProfile } = useAuth() as any;
  const isAdmin = userProfile?.role === "admin" || (userProfile?.roles || []).includes("admin");

  return (
    <Dialog open={!!driver} onOpenChange={(o) => { if (!o) qc.invalidateQueries({ queryKey: ["rota"] }); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{driver?.name || driver?.email}</DialogTitle></DialogHeader>
        {driver && (
          <Tabs defaultValue="weekly">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="weekly">Weekly availability</TabsTrigger>
              <TabsTrigger value="unavailable">Unavailable dates</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly"><DriverAvailabilityTab userId={driver.id} hideLeaveSettings={!isAdmin} /></TabsContent>
            <TabsContent value="unavailable">
              <UnavailableDatesEditor driverId={driver.id} invalidateRota />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
