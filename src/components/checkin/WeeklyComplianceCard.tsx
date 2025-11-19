import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, TrendingUp } from 'lucide-react';

interface WeeklyComplianceCardProps {
  totalCheckins: number;
  onTimeCheckins: number;
  compliancePercentage: number;
}

export function WeeklyComplianceCard({ 
  totalCheckins, 
  onTimeCheckins, 
  compliancePercentage 
}: WeeklyComplianceCardProps) {
  const isEligibleForBonus = compliancePercentage >= 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          This Week's Performance
        </CardTitle>
        <CardDescription>Monday - Sunday</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Compliance Rate</span>
            <span className={`text-2xl font-bold ${isEligibleForBonus ? 'text-green-600' : 'text-muted-foreground'}`}>
              {compliancePercentage.toFixed(0)}%
            </span>
          </div>
          <Progress value={compliancePercentage} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Check-Ins</p>
            <p className="text-2xl font-bold">{totalCheckins}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">On Time</p>
            <p className="text-2xl font-bold text-green-600">{onTimeCheckins}</p>
          </div>
        </div>

        {isEligibleForBonus && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Bonus Eligible!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You're on track for the £50 weekly punctuality bonus
                </p>
              </div>
            </div>
          </div>
        )}

        {!isEligibleForBonus && totalCheckins > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Keep Going!
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You need 80% on-time check-ins to qualify for the weekly bonus
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
