
import React from 'react';
import { format, addDays, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, MapPinIcon } from "lucide-react";
import { OrderData } from '@/pages/JobScheduling';

type GroupedOrders = {
  [key: string]: {
    [polygonSegment: number]: {
      collections: OrderData[];
      deliveries: OrderData[];
    };
  };
};

interface SchedulingTimelineProps {
  orders: OrderData[];
}

const getPolygonBadgeVariant = (segment: number) => {
  const safeSegment = Math.min(Math.max(1, segment), 8);
  return `p${safeSegment}-segment` as 
    "p1-segment" | "p2-segment" | "p3-segment" | "p4-segment" | 
    "p5-segment" | "p6-segment" | "p7-segment" | "p8-segment";
};

const SchedulingTimeline: React.FC<SchedulingTimelineProps> = ({ orders }) => {
  const today = new Date();
  
  // Generate dates for past and future 7 days
  const dates = [
    ...Array(7).fill(null).map((_, i) => subDays(today, 7-i)),
    today,
    ...Array(7).fill(null).map((_, i) => addDays(today, i+1))
  ];

  // Group orders by date and polygon segment
  const groupOrders = () => {
    const grouped: GroupedOrders = {};
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      grouped[dateKey] = {};
    });

    orders.forEach(order => {
      // For scheduled orders
      if (order.scheduled_pickup_date) {
        const dateKey = format(new Date(order.scheduled_pickup_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) return;
        
        const segment = order.senderPolygonSegment;
        if (!segment) return;
        
        if (!grouped[dateKey][segment]) {
          grouped[dateKey][segment] = { collections: [], deliveries: [] };
        }
        grouped[dateKey][segment].collections.push(order);
      }
      
      if (order.scheduled_delivery_date) {
        const dateKey = format(new Date(order.scheduled_delivery_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) return;
        
        const segment = order.receiverPolygonSegment;
        if (!segment) return;
        
        if (!grouped[dateKey][segment]) {
          grouped[dateKey][segment] = { collections: [], deliveries: [] };
        }
        grouped[dateKey][segment].deliveries.push(order);
      }
      
      // For unscheduled orders with available dates
      if (!order.scheduled_pickup_date && order.pickup_date) {
        const pickupDates = Array.isArray(order.pickup_date) ? order.pickup_date : [order.pickup_date];
        pickupDates.forEach(date => {
          const dateKey = format(new Date(date), 'yyyy-MM-dd');
          if (!grouped[dateKey]) return;
          
          const segment = order.senderPolygonSegment;
          if (!segment) return;
          
          if (!grouped[dateKey][segment]) {
            grouped[dateKey][segment] = { collections: [], deliveries: [] };
          }
          if (!grouped[dateKey][segment].collections.find(o => o.id === order.id)) {
            grouped[dateKey][segment].collections.push(order);
          }
        });
      }
      
      if (!order.scheduled_delivery_date && order.delivery_date) {
        const deliveryDates = Array.isArray(order.delivery_date) ? order.delivery_date : [order.delivery_date];
        deliveryDates.forEach(date => {
          const dateKey = format(new Date(date), 'yyyy-MM-dd');
          if (!grouped[dateKey]) return;
          
          const segment = order.receiverPolygonSegment;
          if (!segment) return;
          
          if (!grouped[dateKey][segment]) {
            grouped[dateKey][segment] = { collections: [], deliveries: [] };
          }
          if (!grouped[dateKey][segment].deliveries.find(o => o.id === order.id)) {
            grouped[dateKey][segment].deliveries.push(order);
          }
        });
      }
    });

    return grouped;
  };

  const groupedOrders = groupOrders();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Scheduling Timeline</h2>
      <ScrollArea className="h-[600px] rounded-md border p-4">
        <div className="space-y-8">
          {dates.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            const hasOrders = Object.keys(groupedOrders[dateKey]).length > 0;
            
            if (!hasOrders) return null;
            
            return (
              <Card key={dateKey}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    <span>{format(date, 'EEEE, MMMM d, yyyy')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedOrders[dateKey]).map(([segment, jobs]) => (
                      <div key={`${dateKey}-${segment}`} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4" />
                          <Badge variant={getPolygonBadgeVariant(Number(segment))}>
                            Polygon {segment}
                          </Badge>
                        </div>
                        
                        {jobs.collections.length > 0 && (
                          <div className="pl-4 space-y-2">
                            <h4 className="font-medium">Collections</h4>
                            {jobs.collections.map(order => (
                              <Card key={`collection-${order.id}`}>
                                <CardContent className="p-4">
                                  <p className="font-medium">{order.tracking_number}</p>
                                  <p className="text-sm text-muted-foreground">
                                    From: {order.sender.address.street}, {order.sender.address.city}
                                  </p>
                                  {order.scheduled_pickup_date && (
                                    <Badge variant="outline" className="mt-2">
                                      Scheduled: {format(new Date(order.scheduled_pickup_date), 'h:mm a')}
                                    </Badge>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                        
                        {jobs.deliveries.length > 0 && (
                          <div className="pl-4 space-y-2">
                            <h4 className="font-medium">Deliveries</h4>
                            {jobs.deliveries.map(order => (
                              <Card key={`delivery-${order.id}`}>
                                <CardContent className="p-4">
                                  <p className="font-medium">{order.tracking_number}</p>
                                  <p className="text-sm text-muted-foreground">
                                    To: {order.receiver.address.street}, {order.receiver.address.city}
                                  </p>
                                  {order.scheduled_delivery_date && (
                                    <Badge variant="outline" className="mt-2">
                                      Scheduled: {format(new Date(order.scheduled_delivery_date), 'h:mm a')}
                                    </Badge>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SchedulingTimeline;
