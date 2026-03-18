import React from "react";
import { MapPin, ArrowRight, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import RouteWhyPanel from "./RouteWhyPanel";
interface RouteStop {
  stop_id: string;
  order_id: string;
  type: string;
  contact_name: string;
  address: string;
  postcode_prefix: string;
  region?: string;
  lat: number;
  lon: number;
  date_match: 'exact' | 'flexible' | 'no_dates';
  sequenceOrder?: number;
  estimatedArrivalTime?: string;
}

interface PredictedRouteCardProps {
  driverSlot: number;
  day: string;
  stops: RouteStop[];
  estimatedMiles?: number;
  isOptimized?: boolean;
  onOptimize: () => void;
  isOptimizing?: boolean;
  archetypeLabel?: string;
  similarityScore?: number;
  compactnessScore?: number;
}

const PredictedRouteCard: React.FC<PredictedRouteCardProps> = ({
  driverSlot,
  day,
  stops,
  estimatedMiles,
  isOptimized,
  onOptimize,
  isOptimizing,
  archetypeLabel,
  similarityScore,
  compactnessScore,
}) => {
  const navigate = useNavigate();

  const collections = stops.filter(s => s.type === 'collection');
  const deliveries = stops.filter(s => s.type === 'delivery');

  const handleLoadIntoRouteBuilder = () => {
    const jobParams = stops.map(s => `${s.order_id}:${s.type === 'collection' ? 'pickup' : 'delivery'}`).join(',');
    navigate(`/scheduling?jobs=${jobParams}&date=${day}`);
  };

  const getDateMatchBadge = (match: string) => {
    switch (match) {
      case 'exact':
        return <Badge variant="success" className="text-[10px] px-1.5 py-0">Available</Badge>;
      case 'flexible':
        return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Not Preferred</Badge>;
      case 'no_dates':
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">No Dates</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Driver Slot {driverSlot}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{collections.length} pickups</span>
            <span>•</span>
            <span>{deliveries.length} deliveries</span>
          </div>
        </div>
        {/* Show regions covered by this route */}
        {(() => {
          const regions = [...new Set(stops.map(s => s.region).filter(Boolean))];
          return regions.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {regions.map(r => (
                <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">{r}</Badge>
              ))}
            </div>
          ) : null;
        })()}
        {archetypeLabel && (
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{archetypeLabel}</Badge>
            {similarityScore !== undefined && (
              <span className="text-[10px] text-muted-foreground">{Math.round(similarityScore * 100)}% match</span>
            )}
          </div>
        )}
        {estimatedMiles !== undefined && (
          <p className="text-xs text-muted-foreground">Est. {estimatedMiles.toFixed(1)} miles</p>
        )}
        <RouteWhyPanel
          archetypeLabel={archetypeLabel}
          similarityScore={similarityScore}
          compactnessScore={compactnessScore}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {stops.map((stop, idx) => (
            <div key={stop.stop_id} className="flex items-start gap-2 text-sm py-1 border-b border-border/30 last:border-0">
              <div className="flex-shrink-0 mt-0.5">
                {stop.sequenceOrder !== undefined ? (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {stop.sequenceOrder}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px]">
                    {idx + 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge variant={stop.type === 'collection' ? 'progress' : 'active'} className="text-[10px] px-1.5 py-0">
                    {stop.type === 'collection' ? 'P' : 'D'}
                  </Badge>
                  <span className="font-medium text-xs truncate">{stop.contact_name}</span>
                  {getDateMatchBadge(stop.date_match)}
                </div>
                <p className="text-xs text-muted-foreground truncate">{stop.postcode_prefix} — {stop.address}</p>
                {stop.estimatedArrivalTime && (
                  <p className="text-[10px] text-primary">ETA: {stop.estimatedArrivalTime}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOptimize}
            disabled={isOptimizing}
            className="flex-1 text-xs"
          >
            {isOptimizing ? 'Optimizing...' : isOptimized ? 'Re-optimize' : 'Optimize Sequence'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleLoadIntoRouteBuilder}
            className="flex-1 text-xs"
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Load into Builder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PredictedRouteCard;
