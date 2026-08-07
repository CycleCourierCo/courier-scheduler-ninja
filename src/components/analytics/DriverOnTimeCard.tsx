import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { OnTimeStats } from "@/services/driverAnalyticsService";

interface Props {
  stats: OnTimeStats;
}

const DriverOnTimeCard = ({ stats }: Props) => {
  const measurable = stats.onTime + stats.early + stats.late;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">On-Time Performance</CardTitle>
        <CardDescription>
          Actual completion time against the 3-hour window we promised the customer. Legs without a promised window or a
          recorded completion are shown separately, not counted as late.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {measurable === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No measurable legs in this period{stats.noData > 0 ? ` (${stats.noData} with no data)` : ""}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold">{stats.rate}%</span>
              <span className="text-sm text-muted-foreground">
                within window · {measurable} legs measured
              </span>
            </div>
            <Progress value={stats.rate} />
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">{stats.onTime} in window</Badge>
              <Badge variant="secondary">{stats.early} early</Badge>
              <Badge variant="destructive">{stats.late} late</Badge>
              <Badge variant="outline">{stats.noData} no data</Badge>
            </div>
            {stats.late > 0 && (
              <p className="text-xs text-muted-foreground">
                Late legs average {stats.avgMinutesLate} minutes past the end of the window.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DriverOnTimeCard;
