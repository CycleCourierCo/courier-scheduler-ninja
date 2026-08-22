import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEmployeeReviewHistory } from "@/hooks/useReviews";

interface Props {
  employeeId: string | undefined;
}

const ReviewHistoryPanel: React.FC<Props> = ({ employeeId }) => {
  const { data: history = [], isLoading } = useEmployeeReviewHistory(employeeId);

  if (isLoading) return null;
  if (!history.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performance history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="overall" name="Overall" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="self" name="Self" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="performance" name="Performance" stroke="hsl(var(--chart-2, var(--primary)))" />
              <Line type="monotone" dataKey="behaviour" name="Behaviour" stroke="hsl(var(--destructive))" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Period</th>
                <th className="py-2 pr-3 font-medium">Overall</th>
                <th className="py-2 pr-3 font-medium">Performance</th>
                <th className="py-2 pr-3 font-medium">Behaviour</th>
                <th className="py-2 font-medium">Self</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map(h => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{new Date(h.period_end).toLocaleDateString("en-GB")}</td>
                  <td className="py-2 pr-3 font-medium">{h.overall ?? "—"}</td>
                  <td className="py-2 pr-3">{h.performance ?? "—"}</td>
                  <td className="py-2 pr-3">{h.behaviour ?? "—"}</td>
                  <td className="py-2">{h.self ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewHistoryPanel;
