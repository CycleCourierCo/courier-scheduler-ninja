import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StageDuration } from "@/services/inspectionAnalyticsService";

interface Props {
  data: StageDuration[];
}

const formatDuration = (hours: number): string => {
  if (!hours || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

const InspectionStageDurationsChart = ({ data }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection Stage Durations</CardTitle>
      </CardHeader>
      <CardContent className="h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(v) => formatDuration(Number(v))}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="stage"
              width={180}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: any, _name, props: any) => {
                const row = props?.payload as StageDuration | undefined;
                return [
                  `${formatDuration(Number(value))} avg · ${formatDuration(row?.medianHours ?? 0)} median (n=${row?.sampleSize ?? 0})`,
                  "Duration",
                ];
              }}
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Bar dataKey="avgHours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
              <LabelList
                dataKey="avgHours"
                position="right"
                formatter={(v: number) => formatDuration(v)}
                style={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default InspectionStageDurationsChart;
