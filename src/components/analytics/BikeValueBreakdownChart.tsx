import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGBP } from "@/services/bikeValueAnalyticsService";

interface Bucket {
  label: string;
  totalValue: number;
  count: number;
}

interface Props {
  byType: Bucket[];
  byBrand: Bucket[];
}

const Panel = ({ title, data }: { title: string; data: Bucket[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No data.</div>
      ) : (
        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" tickFormatter={(v) => formatGBP(Number(v))} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: any, _name, entry: any) => [
                  `${formatGBP(Number(value))} (${entry?.payload?.count ?? 0} bikes)`,
                  "Total Value",
                ]}
              />
              <Bar dataKey="totalValue" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);

const BikeValueBreakdownChart = ({ byType, byBrand }: Props) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
    <Panel title="Top Bike Types by Value" data={byType} />
    <Panel title="Top Brands by Value" data={byBrand} />
  </div>
);

export default BikeValueBreakdownChart;
