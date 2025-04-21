
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, subDays } from 'date-fns';
import { OrderData } from '@/pages/JobScheduling';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calendar } from 'lucide-react';

interface SchedulingTimelineProps {
  orders: OrderData[];
}

interface GroupedOrders {
  [key: string]: {
    collections: OrderData[];
    deliveries: OrderData[];
  };
}

const SchedulingTimeline: React.FC<SchedulingTimelineProps> = ({ orders }) => {
  const today = new Date();
  const futureDates = Array.from({length: 7}, (_, i) => addDays(today, i));
  const pastDates = Array.from({length: 7}, (_, i) => subDays(today, i + 1)).reverse();

  const getPolygonBadgeVariant = (segment: number | undefined) => {
    if (!segment) return undefined;
    const safeSegment = Math.min(Math.max(1, segment), 8);
    return `p${safeSegment}-segment` as 
      "p1-segment" | "p2-segment" | "p3-segment" | "p4-segment" | 
      "p5-segment" | "p6-segment" | "p7-segment" | "p8-segment";
  };

  const groupOrdersByDate = (orderList: OrderData[], dates: Date[]): GroupedOrders => {
    const grouped: GroupedOrders = {};
    
    dates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      grouped[dateStr] = {
        collections: [],
        deliveries: []
      };
    });

    orderList.forEach(order => {
      if (order.scheduled_pickup_date || order.scheduled_delivery_date) {
        // Handle scheduled orders
        if (order.scheduled_pickup_date) {
          const dateStr = format(new Date(order.scheduled_pickup_date), 'yyyy-MM-dd');
          if (grouped[dateStr]) {
            grouped[dateStr].collections.push(order);
          }
        }
        if (order.scheduled_delivery_date) {
          const dateStr = format(new Date(order.scheduled_delivery_date), 'yyyy-MM-dd');
          if (grouped[dateStr]) {
            grouped[dateStr].deliveries.push(order);
          }
        }
      } else {
        // Handle unscheduled orders - put them in the next available day
        const availableDate = futureDates.find(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          return grouped[dateStr].collections.length < 5 && grouped[dateStr].deliveries.length < 5;
        });
        
        if (availableDate) {
          const dateStr = format(availableDate, 'yyyy-MM-dd');
          grouped[dateStr].collections.push(order);
          // Add delivery for the next day if possible
          const nextDay = format(addDays(availableDate, 1), 'yyyy-MM-dd');
          if (grouped[nextDay]) {
            grouped[nextDay].deliveries.push(order);
          }
        }
      }
    });

    return grouped;
  };

  const scheduledOrders = orders.filter(order => 
    order.scheduled_pickup_date || order.scheduled_delivery_date
  );
  
  const unscheduledOrders = orders.filter(order => 
    !order.scheduled_pickup_date && !order.scheduled_delivery_date
  );

  const pastGroupedOrders = groupOrdersByDate(scheduledOrders, pastDates);
  const futureGroupedOrders = groupOrdersByDate(unscheduledOrders, futureDates);

  const renderOrdersForDate = (dateStr: string, groupedOrders: GroupedOrders) => {
    const { collections, deliveries } = groupedOrders[dateStr];
    if (collections.length === 0 && deliveries.length === 0) return null;

    return (
      <Card key={dateStr} className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(new Date(dateStr), 'EEEE, MMMM d, yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {collections.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Collections ({collections.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {collections.map(order => (
                  <Card key={`collection-${order.id}`} className="p-2 bg-green-50">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">#{order.tracking_number}</span>
                        {order.senderPolygonSegment && (
                          <Badge 
                            variant={getPolygonBadgeVariant(order.senderPolygonSegment)}
                            className="text-xs"
                          >
                            P{order.senderPolygonSegment}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {order.sender.address.street}, {order.sender.address.city}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {deliveries.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Deliveries ({deliveries.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {deliveries.map(order => (
                  <Card key={`delivery-${order.id}`} className="p-2 bg-blue-50">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">#{order.tracking_number}</span>
                        {order.receiverPolygonSegment && (
                          <Badge 
                            variant={getPolygonBadgeVariant(order.receiverPolygonSegment)}
                            className="text-xs"
                          >
                            P{order.receiverPolygonSegment}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {order.receiver.address.street}, {order.receiver.address.city}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Next 7 Days</h2>
        {futureDates.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          return renderOrdersForDate(dateStr, futureGroupedOrders);
        })}
      </div>
      
      <Separator />
      
      <div>
        <h2 className="text-2xl font-bold mb-4">Previous 7 Days</h2>
        {pastDates.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          return renderOrdersForDate(dateStr, pastGroupedOrders);
        })}
      </div>
    </div>
  );
};

export default SchedulingTimeline;
