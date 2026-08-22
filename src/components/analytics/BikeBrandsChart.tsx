import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BikeBrandAnalytics } from "@/services/analyticsService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BikeBrandsChartProps {
  data: BikeBrandAnalytics;
}

const TOP_OPTIONS = ["10", "20", "50", "all"] as const;

const BikeBrandsChart = ({ data }: BikeBrandsChartProps) => {
  const [topN, setTopN] = useState<string>("10");

  const { brands, totalBikes, unspecifiedCount, distinctBrands } = data;

  const { rows, tailBrandCount } = useMemo(() => {
    if (topN === "all") return { rows: brands, tailBrandCount: 0 };
    const limit = Number(topN);
    if (brands.length <= limit) return { rows: brands, tailBrandCount: 0 };

    const head = brands.slice(0, limit);
    const tail = brands.slice(limit);
    const tailCount = tail.reduce((sum, item) => sum + item.count, 0);
    const tailPercentage = tail.reduce((sum, item) => sum + item.percentage, 0);

    return {
      rows: [
        ...head,
        {
          brand: `Other brands (${tail.length})`,
          count: tailCount,
          percentage: tailPercentage,
        },
      ],
      tailBrandCount: tail.length,
    };
  }, [brands, topN]);

  const chartHeight = Math.max(280, rows.length * 28 + 40);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">Bike Brands Distribution</CardTitle>
          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOP_OPTIONS.map((option) => (
                <SelectItem key={option} value={option} className="text-xs">
                  {option === "all" ? "All brands" : `Top ${option}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No bike brands recorded yet.
          </p>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                barCategoryGap={4}
              >
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="brand"
                  width={110}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={0}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(value: number, _name, props: any) => [
                    `${value} bike${value === 1 ? "" : "s"} (${props.payload.percentage.toFixed(1)}%)`,
                    props.payload.brand,
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {rows.map((row) => (
                    <Cell
                      key={row.brand}
                      fill={
                        row.brand.startsWith("Other brands")
                          ? "hsl(var(--muted-foreground))"
                          : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          {totalBikes.toLocaleString()} bikes across {distinctBrands.toLocaleString()} brands after
          cleaning
          {tailBrandCount > 0 && ` · ${tailBrandCount.toLocaleString()} brands grouped as Other`}
          {unspecifiedCount > 0 &&
            ` · ${unspecifiedCount.toLocaleString()} bikes with no brand recorded (excluded)`}
        </p>
      </CardContent>
    </Card>
  );
};

export default BikeBrandsChart;
