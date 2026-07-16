import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PoundSterling, Bike, TrendingUp, Award, Calendar, Layers, Package } from "lucide-react";
import type { BikeValueMetrics } from "@/services/bikeValueAnalyticsService";
import { formatGBP, formatGBPPrecise } from "@/services/bikeValueAnalyticsService";

interface Props {
  scoped: BikeValueMetrics;
  allTime: BikeValueMetrics;
  rangeLabel: string;
}

const Stat = ({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: any;
}) => (
  <Card className="hover-lift">
    <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
      <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">{title}</CardTitle>
      <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
    </CardHeader>
    <CardContent className="p-3 sm:p-6 pt-0">
      <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
      {description && (
        <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{description}</p>
      )}
    </CardContent>
  </Card>
);

const BikeValueStatsCards = ({ scoped, allTime, rangeLabel }: Props) => {
  const hvDate = scoped.highestValueDay
    ? new Date(scoped.highestValueDay.date + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const hvBike = scoped.highestValueBike;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          {rangeLabel}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          <Stat
            title="Total Value Moved"
            value={formatGBP(scoped.totalValueMoved)}
            description={`${scoped.totalBikes} bikes · ${scoped.activeDays} active days`}
            icon={PoundSterling}
          />
          <Stat
            title="Avg Value / Day"
            value={formatGBP(scoped.avgValuePerDay)}
            description={`${scoped.avgBikesPerDay.toFixed(1)} bikes/day avg`}
            icon={Calendar}
          />
          <Stat
            title="Avg Value / Bike"
            value={formatGBPPrecise(scoped.avgValuePerBike)}
            description={`${scoped.valuedBikes} of ${scoped.totalBikes} bikes had a declared value`}
            icon={Bike}
          />
          <Stat
            title="Bikes Moved"
            value={String(scoped.totalBikes)}
            description="Non-cancelled orders"
            icon={Package}
          />
          <Stat
            title="Highest-Value Day"
            value={scoped.highestValueDay ? formatGBP(scoped.highestValueDay.value) : "—"}
            description={hvDate}
            icon={TrendingUp}
          />
          <Stat
            title="Highest-Value Bike"
            value={hvBike ? formatGBP(hvBike.value) : "—"}
            description={
              hvBike
                ? `${hvBike.brand}${hvBike.model ? " " + hvBike.model : ""}`
                : "No declared bike values"
            }
            icon={Award}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">All time</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <Stat
            title="Total Value (All Time)"
            value={formatGBP(allTime.totalValueMoved)}
            description={`${allTime.totalBikes} bikes ever moved`}
            icon={Layers}
          />
          <Stat
            title="Avg Value / Bike (All Time)"
            value={formatGBPPrecise(allTime.avgValuePerBike)}
            description={`${allTime.valuedBikes} bikes with declared values`}
            icon={Bike}
          />
          <Stat
            title="Avg Value / Day (All Time)"
            value={formatGBP(allTime.avgValuePerDay)}
            description={`${allTime.activeDays} active days`}
            icon={Calendar}
          />
          <Stat
            title="Avg Bikes / Day (All Time)"
            value={allTime.avgBikesPerDay.toFixed(1)}
            description="Across all active days"
            icon={Package}
          />
        </div>
      </div>
    </div>
  );
};

export default BikeValueStatsCards;
