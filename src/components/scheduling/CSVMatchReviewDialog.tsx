import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, AlertTriangle, MapPin, Package, Truck, CalendarClock, CircleAlert } from "lucide-react";
import { format } from "date-fns";
import { MatchResult, MatchCandidate, getDeliveryCollectionStatus } from "@/utils/csvRouteParser";

export interface CSVSelectedJob {
  orderId: string;
  jobType: 'pickup' | 'delivery';
  sequence: number;
}

interface CSVMatchReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchResults: MatchResult[];
  onConfirm: (selected: CSVSelectedJob[]) => void;
  onCancel: () => void;
}

const candidateKey = (rowIndex: number, c: MatchCandidate) =>
  `${rowIndex}|${c.order.id}|${c.jobType}`;

const CSVMatchReviewDialog: React.FC<CSVMatchReviewDialogProps> = ({
  open,
  onOpenChange,
  matchResults,
  onConfirm,
  onCancel
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Default selection: the best candidate for each row
  useEffect(() => {
    if (!open) return;
    const defaults = new Set<string>();
    matchResults.forEach((result, index) => {
      if (!result.matchedOrder || !result.jobType) return;
      const top = result.candidates?.find(
        c => c.order.id === result.matchedOrder!.id && c.jobType === result.jobType
      );
      if (top) defaults.add(candidateKey(index, top));
    });
    setSelectedKeys(defaults);
  }, [open, matchResults]);

  const allCandidateKeys = useMemo(() => {
    const keys: string[] = [];
    matchResults.forEach((r, i) => (r.candidates || []).forEach(c => keys.push(candidateKey(i, c))));
    return keys;
  }, [matchResults]);

  // Sequence of pickups currently selected, used for "collection on route" checks
  const pickupSequenceByOrderId = useMemo(() => {
    const map = new Map<string, number>();
    matchResults.forEach((result, index) => {
      (result.candidates || []).forEach(c => {
        if (c.jobType !== 'pickup') return;
        if (!selectedKeys.has(candidateKey(index, c))) return;
        map.set(c.order.id, result.csvRow.sequence);
      });
    });
    return map;
  }, [matchResults, selectedKeys]);

  const selectedJobs: CSVSelectedJob[] = useMemo(() => {
    const jobs: CSVSelectedJob[] = [];
    matchResults.forEach((result, index) => {
      (result.candidates || []).forEach(c => {
        if (!selectedKeys.has(candidateKey(index, c))) return;
        jobs.push({ orderId: c.order.id, jobType: c.jobType, sequence: result.csvRow.sequence });
      });
    });
    return jobs.sort((a, b) => a.sequence - b.sequence);
  }, [matchResults, selectedKeys]);

  const toggle = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalRows = matchResults.length;
  const matchedRows = matchResults.filter(r => (r.candidates?.length || 0) > 0).length;
  const unmatchedRows = totalRows - matchedRows;

  const getMatchBadge = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Exact</Badge>;
      case 'fuzzy':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Fuzzy</Badge>;
      case 'address':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Address</Badge>;
      default:
        return <Badge variant="destructive">No Match</Badge>;
    }
  };

  const renderCollectionStatus = (candidate: MatchCandidate, deliverySequence: number) => {
    if (candidate.jobType !== 'delivery') return null;
    const status = getDeliveryCollectionStatus(candidate.order, deliverySequence, pickupSequenceByOrderId);

    switch (status.kind) {
      case 'collected':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 gap-1">
            <Check className="h-3 w-3" /> Collected
          </Badge>
        );
      case 'on_route_before':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 gap-1">
            <Truck className="h-3 w-3" /> Collecting earlier on route (#{status.sequence})
          </Badge>
        );
      case 'on_route_after':
        return (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 gap-1">
            <AlertTriangle className="h-3 w-3" /> Collection later on route (#{status.sequence})
          </Badge>
        );
      case 'scheduled': {
        let label = status.date;
        try {
          label = format(new Date(status.date), 'dd MMM');
        } catch { /* keep raw */ }
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 gap-1">
            <CalendarClock className="h-3 w-3" /> Collection scheduled {label}
          </Badge>
        );
      }
      default:
        return (
          <Badge variant="destructive" className="gap-1">
            <CircleAlert className="h-3 w-3" /> Not collected
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Choose Jobs To Load
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{selectedJobs.length}</div>
            <div className="text-xs text-muted-foreground">Selected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{matchedRows}</div>
            <div className="text-xs text-muted-foreground">Matched Rows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{unmatchedRows}</div>
            <div className="text-xs text-muted-foreground">Unmatched</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalRows}</div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelectedKeys(new Set(allCandidateKeys))}>
            Select all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedKeys(new Set())}>
            Deselect all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const defaults = new Set<string>();
              matchResults.forEach((result, index) => {
                const top = result.candidates?.[0];
                if (top) defaults.add(candidateKey(index, top));
              });
              setSelectedKeys(defaults);
            }}
          >
            Best match only
          </Button>
        </div>

        {/* Match Details */}
        <ScrollArea className="flex-1 min-h-[240px] max-h-[45vh] rounded-md border p-3">
          <div className="space-y-3">
            {matchResults.map((result, index) => {
              const candidates = result.candidates || [];
              const hasCandidates = candidates.length > 0;
              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    hasCandidates
                      ? 'bg-muted/30 border-border'
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
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
                    {!hasCandidates && (
                      <div className="flex items-center gap-1 text-red-600">
                        <X className="h-4 w-4" />
                        <span className="text-xs">Not Found</span>
                      </div>
                    )}
                  </div>

                  {candidates.length > 1 && (
                    <div className="text-[11px] text-muted-foreground mb-1">
                      {candidates.length} possible jobs for this stop — tick the ones to add
                    </div>
                  )}

                  <div className="space-y-2">
                    {candidates.map((candidate) => {
                      const key = candidateKey(index, candidate);
                      const checked = selectedKeys.has(key);
                      const contact = candidate.jobType === 'pickup'
                        ? candidate.order.sender
                        : candidate.order.receiver;
                      return (
                        <label
                          key={key}
                          htmlFor={key}
                          className={`flex items-start gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-800'
                              : 'bg-background border-border'
                          }`}
                        >
                          <Checkbox
                            id={key}
                            checked={checked}
                            onCheckedChange={() => toggle(key)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={candidate.jobType === 'pickup' ? 'default' : 'secondary'}>
                                {candidate.jobType === 'pickup' ? 'Collection' : 'Delivery'}
                              </Badge>
                              {getMatchBadge(candidate.matchType)}
                              <span className="text-xs text-muted-foreground">
                                {Math.round(candidate.confidence * 100)}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {candidate.order.tracking_number} • {contact?.name}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {renderCollectionStatus(candidate, result.csvRow.sequence)}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedJobs)}
            disabled={selectedJobs.length === 0}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Load {selectedJobs.length} Job{selectedJobs.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVMatchReviewDialog;
