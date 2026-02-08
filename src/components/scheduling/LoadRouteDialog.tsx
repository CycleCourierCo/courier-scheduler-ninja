import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen, Search, Trash2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { OrderData } from "@/pages/JobScheduling";

interface SavedJobData {
  orderId: string;
  type: 'pickup' | 'delivery' | 'break';
  address: string;
  contactName: string;
  phoneNumber: string;
  order: number;
  estimatedTime?: string;
  lat?: number;
  lon?: number;
  breakDuration?: number;
  breakType?: 'lunch' | 'stop';
}

interface SavedRoute {
  id: string;
  name: string;
  job_data: SavedJobData[];
  start_time: string;
  starting_bikes: number;
  created_by: string;
  created_at: string;
}

interface LoadedJob {
  orderId: string;
  type: 'pickup' | 'delivery' | 'break';
  address: string;
  contactName: string;
  phoneNumber: string;
  order: number;
  estimatedTime?: string;
  lat?: number;
  lon?: number;
  breakDuration?: number;
  breakType?: 'lunch' | 'stop';
  orderData?: OrderData;
}

interface LoadRouteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderData[];
  onLoadRoute: (jobs: LoadedJob[], startTime: string, startingBikes: number) => void;
}

const LoadRouteDialog: React.FC<LoadRouteDialogProps> = ({
  open,
  onOpenChange,
  orders,
  onLoadRoute
}) => {
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchSavedRoutes();
    }
  }, [open]);

  const fetchSavedRoutes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_routes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse job_data from JSON
      const routes = (data || []).map(route => ({
        ...route,
        job_data: (route.job_data as unknown as SavedJobData[]) || []
      }));

      setSavedRoutes(routes);
    } catch (error: any) {
      console.error("Error fetching saved routes:", error);
      toast.error(`Failed to load saved routes: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadRoute = (route: SavedRoute) => {
    // Re-hydrate orderData from current orders
    const loadedJobs: LoadedJob[] = route.job_data.map(savedJob => {
      const order = orders.find(o => o.id === savedJob.orderId);
      return {
        ...savedJob,
        orderData: order
      };
    });

    // Check for stale jobs (jobs that no longer exist in orders)
    const staleCount = loadedJobs.filter(j => j.type !== 'break' && !j.orderData).length;
    
    if (staleCount > 0) {
      toast.warning(`${staleCount} job(s) in this route are no longer available`);
    }

    onLoadRoute(loadedJobs, route.start_time, route.starting_bikes);
    onOpenChange(false);
    toast.success(`Route "${route.name}" loaded successfully`);
  };

  const handleDeleteRoute = async (routeId: string) => {
    setDeletingId(routeId);
    try {
      const { error } = await supabase
        .from('saved_routes')
        .delete()
        .eq('id', routeId);

      if (error) throw error;

      setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
      toast.success("Route deleted");
    } catch (error: any) {
      console.error("Error deleting route:", error);
      toast.error(`Failed to delete route: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRoutes = savedRoutes.filter(route =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getJobStats = (jobData: SavedJobData[]) => {
    const collections = jobData.filter(j => j.type === 'pickup').length;
    const deliveries = jobData.filter(j => j.type === 'delivery').length;
    const total = collections + deliveries;
    return { total, collections, deliveries };
  };

  const checkRouteViability = (jobData: SavedJobData[]) => {
    const nonBreakJobs = jobData.filter(j => j.type !== 'break');
    const matchedCount = nonBreakJobs.filter(j => 
      orders.some(o => o.id === j.orderId)
    ).length;
    return {
      matchedCount,
      totalJobs: nonBreakJobs.length,
      allMatched: matchedCount === nonBreakJobs.length
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Load Saved Route
          </DialogTitle>
          <DialogDescription>
            Select a previously saved route to load
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search routes..."
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[300px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Loading saved routes...
              </div>
            ) : filteredRoutes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <FolderOpen className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? "No routes match your search" : "No saved routes yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRoutes.map(route => {
                  const stats = getJobStats(route.job_data);
                  const viability = checkRouteViability(route.job_data);
                  
                  return (
                    <div
                      key={route.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{route.name}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {stats.total} jobs
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {stats.collections}C / {stats.deliveries}D
                            </span>
                            {!viability.allMatched && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {viability.matchedCount}/{viability.totalJobs} available
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Created {format(new Date(route.created_at), "MMM d, yyyy 'at' HH:mm")}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadRoute(route)}
                            className="h-8"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Load
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={deletingId === route.id}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Route</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{route.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRoute(route.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoadRouteDialog;
