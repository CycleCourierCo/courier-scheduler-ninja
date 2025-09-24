import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StorageAllocation } from "@/pages/LoadingUnloadingPage";

interface StorageUnitLayoutProps {
  storageAllocations: StorageAllocation[];
}

export const StorageUnitLayout = ({ storageAllocations }: StorageUnitLayoutProps) => {
  const bays = ['A', 'B', 'C', 'D'];
  const positions = Array.from({ length: 15 }, (_, i) => i + 1);

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
      <div className="min-w-[900px] space-y-3">
        {bays.map((bay) => (
          <div key={bay} className="flex items-center gap-4">
            <div className="w-16 text-center font-bold text-lg text-primary">
              Bay {bay}
            </div>
            <Card className="flex-1 p-2 bg-muted/20">
              <div className="flex gap-1">
                {positions.map((position) => {
                  const occupied = isOccupied(bay, position);
                  const allocation = getAllocation(bay, position);
                  
                  return (
                    <div
                      key={`${bay}-${position}`}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center text-xs font-medium rounded border-2 transition-colors",
                        occupied 
                          ? "bg-red-500 text-white border-red-600" 
                          : "bg-green-100 border-green-300 text-green-800 hover:bg-green-200"
                      )}
                      title={
                        occupied 
                          ? `${allocation?.customerName} - ${allocation?.bikeBrand} ${allocation?.bikeModel}`
                          : `Available: ${bay}${position}`
                      }
                    >
                      {position}
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