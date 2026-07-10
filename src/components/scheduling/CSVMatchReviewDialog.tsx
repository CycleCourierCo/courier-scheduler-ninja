import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, AlertTriangle, MapPin, Package } from "lucide-react";
import { MatchResult, getMatchStats } from "@/utils/csvRouteParser";

interface CSVMatchReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchResults: MatchResult[];
  onConfirm: () => void;
  onCancel: () => void;
}

const CSVMatchReviewDialog: React.FC<CSVMatchReviewDialogProps> = ({
  open,
  onOpenChange,
  matchResults,
  onConfirm,
  onCancel
}) => {
  const stats = getMatchStats(matchResults);

  const getMatchBadge = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Exact Match</Badge>;
      case 'fuzzy':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Fuzzy Match</Badge>;
      case 'address':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Address Match</Badge>;
      default:
        return <Badge variant="destructive">No Match</Badge>;
    }
  };

  const getJobTypeBadge = (jobType: 'pickup' | 'delivery' | null) => {
    if (!jobType) return null;
    return (
      <Badge variant={jobType === 'pickup' ? 'default' : 'secondary'}>
        {jobType === 'pickup' ? 'Collection' : 'Delivery'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            CSV Route Match Results
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
            <div className="text-xs text-muted-foreground">Matched</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.unmatched}</div>
            <div className="text-xs text-muted-foreground">Unmatched</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Match Rate</div>
          </div>
        </div>

        {/* Match Details */}
        <ScrollArea className="h-[300px] rounded-md border p-4">
          <div className="space-y-3">
            {matchResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  result.matchedOrder 
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">#{result.csvRow.sequence}</Badge>
                      <span className="font-medium text-sm truncate">{result.csvRow.name}</span>
                    </div>
                    <div className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{result.csvRow.address}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {result.matchedOrder ? (
                      <>
                        {getJobTypeBadge(result.jobType)}
                        {getMatchBadge(result.matchType)}
                      </>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <X className="h-4 w-4" />
                        <span className="text-xs">Not Found</span>
                      </div>
                    )}
                  </div>
                </div>
                {result.matchedOrder && (
                  <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-green-600" />
                      <span>Matched to: {result.matchedOrder.tracking_number}</span>
                      <span className="mx-1">•</span>
                      <span>
                        {result.jobType === 'pickup' 
                          ? result.matchedOrder.sender.name 
                          : result.matchedOrder.receiver.name
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Warning if low match rate */}
        {stats.matched < stats.total * 0.5 && stats.total > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              Low match rate. Some jobs may need manual selection.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={stats.matched === 0}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Load {stats.matched} Job{stats.matched !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVMatchReviewDialog;
