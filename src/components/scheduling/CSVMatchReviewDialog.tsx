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

const candidateKey = (c: MatchCandidate) => `${c.order.id}|${c.jobType}`;

const norm = (s?: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const UK_POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})/i;

// Tolerant stop key: same customer + same postcode + same premise number
// so "…Louth, LN11 0JT" and "…Louth, Lincolnshire LN11 0JT" collapse together.
const stopKey = (name?: string, address?: string) => {
  const addr = address || '';
  const m = addr.match(UK_POSTCODE_RE);
  if (!m) return `${norm(name)}|${norm(addr)}`;
  const postcode = `${m[1]}${m[2]}`.toUpperCase();
  const beforePostcode = addr.slice(0, m.index ?? 0);
  const premiseMatch = beforePostcode.match(/\d+[a-z]?(\s*[-/]\s*\d+[a-z]?)?/i);
  const premise = premiseMatch ? premiseMatch[0].replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
  return `${norm(name)}|${postcode}|${premise}`;
};

interface StopGroup {
  key: string;
  name: string;
  address: string;
  sequence: number;
  sequences: number[];
  rowCount: number;
  candidates: MatchCandidate[];
}

const CSVMatchReviewDialog: React.FC<CSVMatchReviewDialogProps> = ({
  open,
  onOpenChange,
  matchResults,
  onConfirm,
  onCancel
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Group CSV rows into unique stops (same customer + address)
  const stops: StopGroup[] = useMemo(() => {
    const map = new Map<string, StopGroup>();
    matchResults.forEach((result) => {
      const key = stopKey(result.csvRow.name, result.csvRow.address);
      let stop = map.get(key);
      if (!stop) {
        stop = {
          key,
          name: result.csvRow.name,
          address: result.csvRow.address,
          sequence: result.csvRow.sequence,
          sequences: [],
          rowCount: 0,
          candidates: []
        };
        map.set(key, stop);
      }
      stop.rowCount += 1;
      stop.sequences.push(result.csvRow.sequence);
      stop.sequence = Math.min(stop.sequence, result.csvRow.sequence);
      (result.candidates || []).forEach(c => {
        if (!stop!.candidates.some(existing => candidateKey(existing) === candidateKey(c))) {
          stop!.candidates.push(c);
        }
      });
    });
    const list = Array.from(map.values());
    list.forEach(s => {
      s.sequences.sort((a, b) => a - b);
      s.candidates.sort((a, b) => b.confidence - a.confidence);
    });
    return list.sort((a, b) => a.sequence - b.sequence);
  }, [matchResults]);

  const defaultSelection = useMemo(() => {
    const defaults = new Set<string>();
    stops.forEach(stop => {
      const take = Math.min(stop.rowCount, stop.candidates.length);
      stop.candidates.slice(0, take).forEach(c => defaults.add(candidateKey(c)));
    });
    return defaults;
  }, [stops]);

  // Default selection on open
  useEffect(() => {
    if (!open) return;
    setSelectedKeys(new Set(defaultSelection));
  }, [open, defaultSelection]);

  const allCandidateKeys = useMemo(() => {
    const keys: string[] = [];
    stops.forEach(s => s.candidates.forEach(c => keys.push(candidateKey(c))));
    return keys;
  }, [stops]);

  // Sequence of pickups currently selected, used for "collection on route" checks
  const pickupSequenceByOrderId = useMemo(() => {
    const map = new Map<string, number>();
    stops.forEach(stop => {
      stop.candidates.forEach(c => {
        if (c.jobType !== 'pickup') return;
        if (!selectedKeys.has(candidateKey(c))) return;
        map.set(c.order.id, stop.sequence);
      });
    });
    return map;
  }, [stops, selectedKeys]);

  const selectedJobs: CSVSelectedJob[] = useMemo(() => {
    const jobs: CSVSelectedJob[] = [];
    stops.forEach(stop => {
      stop.candidates.forEach(c => {
        if (!selectedKeys.has(candidateKey(c))) return;
        jobs.push({ orderId: c.order.id, jobType: c.jobType, sequence: stop.sequence });
      });
    });
    return jobs.sort((a, b) => a.sequence - b.sequence);
  }, [stops, selectedKeys]);

  const toggle = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalRows = matchResults.length;
  const totalStops = stops.length;
  const unmatchedRows = stops.filter(s => s.candidates.length === 0).length;


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
      <DialogContent className="max-w-2xl h-[92dvh] max-h-[92dvh] sm:h-auto flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Choose Jobs To Load
          </DialogTitle>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="shrink-0 grid grid-cols-4 gap-2 p-2 md:p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold text-green-600">{selectedJobs.length}</div>
            <div className="text-xs text-muted-foreground">Selected</div>
          </div>
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold">{totalStops}</div>
            <div className="text-xs text-muted-foreground">Stops</div>
          </div>
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold text-red-600">{unmatchedRows}</div>
            <div className="text-xs text-muted-foreground">Unmatched</div>
          </div>
          <div className="text-center">
            <div className="text-lg md:text-2xl font-bold text-blue-600">{totalRows}</div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap gap-2">
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
              stops.forEach(stop => {
                const top = stop.candidates[0];
                if (top) defaults.add(candidateKey(top));
              });
              setSelectedKeys(defaults);
            }}
          >

            Best match only
          </Button>
        </div>

        {/* Match Details */}
        <ScrollArea className="flex-1 min-h-0 rounded-md border p-3">
          <div className="space-y-3">
            {stops.map((stop) => {
              const candidates = stop.candidates;
              const hasCandidates = candidates.length > 0;
              return (
                <div
                  key={stop.key}
                  className={`p-3 rounded-lg border ${
                    hasCandidates
                      ? 'bg-muted/30 border-border'
                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {stop.sequences.map(seq => (
                          <Badge key={seq} variant="outline" className="text-xs">#{seq}</Badge>
                        ))}
                        <span className="font-medium text-sm truncate">{stop.name}</span>
                      </div>
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{stop.address}</span>
                      </div>
                    </div>
                    {!hasCandidates && (
                      <div className="flex items-center gap-1 text-red-600">
                        <X className="h-4 w-4" />
                        <span className="text-xs">Not Found</span>
                      </div>
                    )}
                  </div>

                  {stop.rowCount > 1 && (
                    <div className="text-[11px] text-muted-foreground mb-1">
                      {stop.rowCount} CSV rows merged into this stop
                    </div>
                  )}

                  {candidates.length > 1 && (
                    <div className="text-[11px] text-muted-foreground mb-1">
                      {candidates.length} possible jobs for this stop — tick the ones to add
                    </div>
                  )}

                  <div className="space-y-2">
                    {candidates.map((candidate) => {
                      const key = candidateKey(candidate);
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
                              {renderCollectionStatus(candidate, stop.sequence)}
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

        <DialogFooter className="shrink-0 gap-2">
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
