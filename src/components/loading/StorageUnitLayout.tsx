import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";
import { MapPin, Package, Calendar } from "lucide-react";
import { format } from "date-fns";

interface StorageUnitLayoutProps {
  storageAllocations: StorageAllocation[];
}

export const StorageUnitLayout = ({ storageAllocations }: StorageUnitLayoutProps) => {
  const bays = ['A', 'B', 'C', 'D'];
  const positions = Array.from({ length: 20 }, (_, i) => i + 1);

  const isOccupied = (bay: string, position: number) => {
    return storageAllocations.some(
      allocation => allocation.bay === bay && allocation.position === position
    );
  };

  const getAllocation = (bay: string, position: number) => {
    return storageAllocations.find(
      allocation => allocation.bay === bay && allocation.position === position
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[320px] sm:min-w-[600px] lg:min-w-[900px] space-y-3">
        {bays.map((bay) => (
          <div key={bay} className="flex items-center gap-2 sm:gap-4">
            <div className="w-12 sm:w-16 text-center font-bold text-sm sm:text-lg text-primary flex-shrink-0">
              <span className="hidden sm:inline">Bay </span>{bay}
            </div>
            <Card className="flex-1 p-1 sm:p-2 bg-muted/20">
                <div className="flex gap-0.5 sm:gap-1">
                  {positions.map((position) => {
                    const occupied = isOccupied(bay, position);
                    const allocation = getAllocation(bay, position);
                    
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
                        <HoverCard key={`${bay}-${position}`}>
                          <HoverCardTrigger asChild>
                            {bayContent}
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="font-mono">
                                  {allocation.bay}{allocation.position}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Occupied
                                </Badge>
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
                                  Stored: {format(allocation.allocatedAt, 'MMM dd, yyyy HH:mm')}
                                </div>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    }
                    
                    return (
                      <div key={`${bay}-${position}`}>
                        {bayContent}
                      </div>
                    );
                  })}
              </div>
            </Card>
          </div>
        ))}
        
        <div className="flex gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 border-2 border-red-600 rounded"></div>
            <span>Occupied</span>
          </div>
        </div>
      </div>
    </div>
  );
};