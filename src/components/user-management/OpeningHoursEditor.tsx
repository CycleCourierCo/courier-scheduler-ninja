import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { OpeningHours, DayHours, DAY_NAMES, DEFAULT_OPENING_HOURS } from "@/types/user";

interface OpeningHoursEditorProps {
  value: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}

const OpeningHoursEditor: React.FC<OpeningHoursEditorProps> = ({ value, onChange }) => {
  const hours = value || DEFAULT_OPENING_HOURS;

  const updateDay = (day: keyof OpeningHours, updates: Partial<DayHours>) => {
    onChange({
      ...hours,
      [day]: { ...hours[day], ...updates },
    });
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Opening Hours</Label>
      <div className="space-y-2">
        {DAY_NAMES.filter(day => day !== 'friday').map((day) => {
          const dayData = hours[day];
          return (
            <div key={day} className="flex items-center gap-3 flex-wrap">
              <div className="w-24 flex items-center gap-2">
                <Switch
                  checked={dayData.open}
                  onCheckedChange={(checked) => updateDay(day, { open: checked })}
                />
                <span className="text-xs capitalize">{day.slice(0, 3)}</span>
              </div>
              {dayData.open && (
                <>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={dayData.is24h}
                      onCheckedChange={(checked) => updateDay(day, { is24h: checked })}
                    />
                    <span className="text-xs">24h</span>
                  </div>
                  {!dayData.is24h && (
                    <>
                      <Input
                        type="time"
                        value={dayData.start}
                        onChange={(e) => updateDay(day, { start: e.target.value })}
                        className="w-28 h-8 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={dayData.end}
                        onChange={(e) => updateDay(day, { end: e.target.value })}
                        className="w-28 h-8 text-xs"
                      />
                    </>
                  )}
                </>
              )}
              {!dayData.open && (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OpeningHoursEditor;
