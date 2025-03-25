
import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SchedulingGroup, SchedulingJobGroup } from "@/services/schedulingService";
import { Badge } from "@/components/ui/badge";
import { useDroppable } from "@/hooks/useDroppable";
import { format } from "date-fns";

interface SchedulingCalendarProps {
  jobGroups: SchedulingJobGroup[];
  onDropGroup: (group: SchedulingGroup, date: Date) => void;
}

const SchedulingCalendar: React.FC<SchedulingCalendarProps> = ({ 
  jobGroups,
  onDropGroup,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Generate a mapping of dates to the number of groups scheduled for that date
  const scheduledDatesMap = jobGroups.reduce<Record<string, number>>((acc, jobGroup) => {
    const dateStr = format(jobGroup.date, 'yyyy-MM-dd');
    acc[dateStr] = jobGroup.groups.length;
    return acc;
  }, {});
  
  // Custom renderer for calendar days
  const renderDay = (date: Date, modifiers: Record<string, boolean>) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const count = scheduledDatesMap[dateStr] || 0;
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {date.getDate()}
        {count > 0 && (
          <Badge 
            variant="secondary" 
            className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[10px]"
          >
            {count}
          </Badge>
        )}
      </div>
    );
  };
  
  // Get the currently selected job group if any
  const selectedJobGroup = selectedDate 
    ? jobGroups.find(jg => format(jg.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))
    : undefined;
  
  const { dropRef } = useDroppable({
    accept: "scheduling-group",
    onDrop: (item: SchedulingGroup) => {
      if (selectedDate) {
        onDropGroup(item, selectedDate);
      }
    },
  });

  return (
    <div className="flex flex-col space-y-4">
      <Calendar 
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        className="rounded-md border"
        components={{
          Day: ({ date, ...props }) => renderDay(date, props.selected || {}),
        }}
      />
      
      <Card ref={dropRef} className="min-h-[200px] border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedJobGroup && selectedJobGroup.groups.length > 0 ? (
            <div className="space-y-2">
              {selectedJobGroup.groups.map((group) => (
                <div key={group.id} className="p-2 bg-secondary rounded-md">
                  <div className="font-medium">
                    {group.locationPair.from} → {group.locationPair.to}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {group.orders.length} orders
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              Drop a group here to schedule for this date
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulingCalendar;
