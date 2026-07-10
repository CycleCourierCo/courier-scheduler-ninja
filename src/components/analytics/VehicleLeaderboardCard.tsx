import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VehicleLeaderboardRow } from "@/services/vehicleAnalyticsService";

interface Props {
  rows: VehicleLeaderboardRow[];
}

const VehicleLeaderboardCard = ({ rows }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Vehicle Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No vehicle data for this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Miles</TableHead>
                  <TableHead className="text-right">Routes</TableHead>
                  <TableHead className="text-right">Active days</TableHead>
                  <TableHead className="text-right">Miles / route</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.vehicle_id}>
                    <TableCell className="font-mono font-medium">{r.registration}</TableCell>
                    <TableCell className="text-right">{r.miles.toLocaleString("en-GB")}</TableCell>
                    <TableCell className="text-right">{r.routes.toLocaleString("en-GB")}</TableCell>
                    <TableCell className="text-right">{r.activeDays}</TableCell>
                    <TableCell className="text-right">
                      {r.routes > 0 ? Math.round(r.miles / r.routes) : 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleLeaderboardCard;
