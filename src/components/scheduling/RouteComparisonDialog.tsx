import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, ExternalLink, Package, Truck } from "lucide-react";
import { RouteAnalysis } from "@/utils/csvRouteParser";

interface RouteComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeAnalyses: RouteAnalysis[];
  filterDate?: Date;
  onLoadRoute: (analysis: RouteAnalysis) => void;
}

const RouteComparisonDialog: React.FC<RouteComparisonDialogProps> = ({
  open,
  onOpenChange,
  routeAnalyses,
  filterDate,
  onLoadRoute,
}) => {
  const totalIssues = (analysis: RouteAnalysis) => 
    analysis.issues.notCollected + 
    analysis.issues.collectionWrongDate + 
    analysis.issues.deliveryWrongDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Compare Routes</span>
            {filterDate && (
              <Badge variant="outline" className="ml-2">
                {format(filterDate, 'EEE, d MMM yyyy')}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {routeAnalyses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No routes to compare. Upload CSV files to analyze.
              </p>
            ) : (
              routeAnalyses.map((analysis, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm truncate flex-1">
                        {analysis.fileName}
                      </h3>
                      <Badge 
                        variant={analysis.viableJobs > 0 ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {analysis.viableJobs} viable
                      </Badge>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="flex flex-wrap gap-3 mb-3 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Matched:</span>
                        <span className="font-medium">{analysis.totalMatched}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Viable:</span>
                        <span className="font-medium text-green-600">{analysis.viableJobs}</span>
                      </div>
                      {totalIssues(analysis) > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Issues:</span>
                          <span className="font-medium text-amber-600">{totalIssues(analysis)}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Breakdown Row */}
                    <div className="flex flex-wrap gap-4 mb-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-blue-500" />
                        <span>Collections: {analysis.viableCollections}/{analysis.collections}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-green-500" />
                        <span>Deliveries: {analysis.viableDeliveries}/{analysis.deliveries}</span>
                      </div>
                    </div>
                    
                    {/* Issues */}
                    {totalIssues(analysis) > 0 && (
                      <div className="bg-muted/50 rounded-md p-2 mb-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Issues:</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.issues.notCollected > 0 && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {analysis.issues.notCollected} not collected
                            </Badge>
                          )}
                          {analysis.issues.collectionWrongDate > 0 && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {analysis.issues.collectionWrongDate} collection wrong date
                            </Badge>
                          )}
                          {analysis.issues.deliveryWrongDate > 0 && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {analysis.issues.deliveryWrongDate} delivery wrong date
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Load Button */}
                    <Button
                      onClick={() => onLoadRoute(analysis)}
                      disabled={analysis.totalMatched === 0}
                      className="w-full"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Load {analysis.totalMatched} Jobs
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RouteComparisonDialog;
