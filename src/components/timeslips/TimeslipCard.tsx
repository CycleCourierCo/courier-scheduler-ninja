import React from 'react';
import { Timeslip } from '@/types/timeslip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, TrendingUp, Check, X, Edit, ExternalLink, Zap, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TimeslipCardProps {
  timeslip: Timeslip;
  isAdmin: boolean;
  onEdit?: (timeslip: Timeslip) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const TimeslipCard: React.FC<TimeslipCardProps> = ({
  timeslip,
  isAdmin,
  onEdit,
  onApprove,
  onReject
}) => {

  const statusColors = {
    draft: 'bg-yellow-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500'
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {timeslip.driver?.name || 'Unknown Driver'}
                <Badge variant="outline" className={statusColors[timeslip.status]}>
                  {timeslip.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                {format(new Date(timeslip.date), 'EEEE, MMMM d, yyyy')}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                £{timeslip.total_pay.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Total Pay</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Hours Breakdown */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{timeslip.driving_hours}h</span>
                <span className="text-muted-foreground">driving</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{timeslip.stop_hours}h</span>
                <span className="text-muted-foreground">stops</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{timeslip.lunch_hours}h</span>
                <span className="text-muted-foreground">lunch</span>
              </div>
            </div>
            
            {timeslip.custom_addons && timeslip.custom_addons.length > 0 && (
              <div className="space-y-1">
                {timeslip.custom_addons.map((addon, index) => (
                  <div key={index} className="flex items-center gap-1 text-sm text-primary">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">{addon.hours}h</span>
                    <span>{addon.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pay Details */}
          <div className="text-sm space-y-1 p-3 bg-muted rounded-lg">
            <div className="flex justify-between">
              <span>Total Hours:</span>
              <span className="font-medium">{timeslip.total_hours}h</span>
            </div>
            <div className="flex justify-between">
              <span>Hourly Rate:</span>
              <span className="font-medium">£{timeslip.hourly_rate.toFixed(2)}/h</span>
            </div>
            {timeslip.van_allowance > 0 && (
              <div className="flex justify-between text-primary">
                <span>Van Allowance:</span>
                <span className="font-medium">£{timeslip.van_allowance.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total Stops:</span>
              <span className="font-medium">{timeslip.total_stops}</span>
            </div>
          </div>

          {/* Route Links */}
          {timeslip.route_links && timeslip.route_links.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Route Maps:</p>
              <div className="flex flex-wrap gap-2">
                {timeslip.route_links.map((link, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(link, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Route {index + 1}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* QuickBooks Bill */}
          {(timeslip as any).quickbooks_bill_id && (
            <div className="flex items-center gap-2 text-sm p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-700 dark:text-green-300">
                QuickBooks Bill #{(timeslip as any).quickbooks_bill_number}
              </span>
              {(timeslip as any).quickbooks_bill_url && (
                <a 
                  href={(timeslip as any).quickbooks_bill_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-auto text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                >
                  View in QB
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Admin Notes */}
          {timeslip.admin_notes && (
            <div className="text-sm p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Admin Notes:</p>
              <p className="text-muted-foreground">{timeslip.admin_notes}</p>
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit?.(timeslip)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              {timeslip.status === 'draft' && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onApprove?.(timeslip.id)}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onReject?.(timeslip.id)}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeslipCard;
