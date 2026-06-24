import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { Package, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useStorageBays } from "@/hooks/useStorageBays";

interface StorageUnitLayoutProps {
  storageAllocations: StorageAllocation[];
}

export const StorageUnitLayout = ({ storageAllocations }: StorageUnitLayoutProps) => {
  const { bays, loading } = useStorageBays();

  const getAllocation = (bay: string, position: number) =>
    storageAllocations.find(
      (a) => a.bay.toUpperCase() === bay.toUpperCase() && a.position === position
    );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (bays.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No bays configured. Ask an admin to add bays in Settings → Storage Bays.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[320px] space-y-3">
        {bays.map((bay) => {
          const positions = Array.from({ length: bay.position_count }, (_, i) => i + 1);
          return (
            <div key={bay.id} className="flex items-center gap-2 sm:gap-4">
              <div className="w-12 sm:w-16 text-center font-bold text-sm sm:text-lg text-primary flex-shrink-0">
                <span className="hidden sm:inline">Bay </span>{bay.label}
              </div>
              <Card className="flex-1 p-1 sm:p-2 bg-muted/20">
                <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                  {positions.map((position) => {
                    const allocation = getAllocation(bay.label, position);
                    const occupied = !!allocation;

                    const bayContent = (
                      <div
                        className={cn(
                          "w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-medium rounded border-2 transition-colors cursor-pointer",
                          occupied
                            ? "bg-red-500 text-white border-red-600"
                            : "bg-green-100 border-green-300 text-green-800 hover:bg-green-200"
                        )}
                      >
                        <span className="text-[10px] sm:text-xs">{position}</span>
                      </div>
                    );

                    if (occupied && allocation) {
                      return (
                        <HoverCard key={`${bay.label}-${position}`}>
                          <HoverCardTrigger asChild>{bayContent}</HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="font-mono">
                                  {allocation.bay}{allocation.position}
                                </Badge>
                                <Badge variant="outline" className="text-xs">Occupied</Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{allocation.customerName}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <p className="font-medium">
                                    {allocation.bikeBrand} {allocation.bikeModel}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  Stored: {format(allocation.allocatedAt, "MMM dd, yyyy HH:mm")}
                                </div>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    }

                    return <div key={`${bay.label}-${position}`}>{bayContent}</div>;
                  })}
                </div>
              </Card>
            </div>
          );
        })}

        <div className="flex gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 border-2 border-red-600 rounded" />
            <span>Occupied</span>
          </div>
        </div>
      </div>
    </div>
  );
};
