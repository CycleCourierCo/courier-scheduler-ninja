import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarOff, Trash2, Plus } from "lucide-react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchHolidays, addHoliday, deleteHoliday, Holiday } from "@/services/holidayService";

const HolidaysPage: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [holidayName, setHolidayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadHolidays = async () => {
    try {
      const data = await fetchHolidays();
      setHolidays(data);
    } catch {
      toast.error("Failed to load holidays");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const existingHolidayDates = holidays.map((h) => h.date);

  const handleAdd = async () => {
    if (!holidayName.trim()) {
      toast.error("Please enter a holiday name");
      return;
    }
    if (selectedDates.length === 0) {
      toast.error("Please select at least one date");
      return;
    }

    setIsSubmitting(true);
    let added = 0;
    let skipped = 0;

    for (const date of selectedDates) {
      const dateStr = format(date, "yyyy-MM-dd");
      if (existingHolidayDates.includes(dateStr)) {
        skipped++;
        continue;
      }
      try {
        await addHoliday(dateStr, holidayName.trim());
        added++;
      } catch {
        skipped++;
      }
    }

    if (added > 0) {
      toast.success(`Added ${added} holiday date${added > 1 ? "s" : ""}`);
    }
    if (skipped > 0) {
      toast.warning(`${skipped} date${skipped > 1 ? "s" : ""} already existed or failed`);
    }

    setSelectedDates([]);
    setHolidayName("");
    await loadHolidays();
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHoliday(id);
      toast.success("Holiday removed");
      await loadHolidays();
    } catch {
      toast.error("Failed to remove holiday");
    }
  };

  // Highlight existing holidays on the calendar
  const holidayDateObjects = holidays.map((h) => new Date(h.date + "T00:00:00"));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <CalendarOff className="h-8 w-8 text-primary" />
          Holiday Management
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add holidays card */}
          <Card>
            <CardHeader>
              <CardTitle>Add Holidays</CardTitle>
              <CardDescription>
                Select dates and provide a name. These dates will be blocked on sender and receiver availability calendars.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="holiday-name">Holiday Name</Label>
                <Input
                  id="holiday-name"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g. Christmas Day, Bank Holiday"
                />
              </div>

              <div className="border rounded-md p-2 bg-background">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates || [])}
                  className="p-3 pointer-events-auto"
                  modifiers={{ holiday: holidayDateObjects }}
                  modifiersClassNames={{ holiday: "bg-destructive/20 text-destructive font-semibold" }}
                />
              </div>

              {selectedDates.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedDates.length} date{selectedDates.length > 1 ? "s" : ""} selected
                </p>
              )}

              <Button
                onClick={handleAdd}
                disabled={isSubmitting || !holidayName.trim() || selectedDates.length === 0}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {isSubmitting ? "Adding..." : "Add Holiday"}
              </Button>
            </CardContent>
          </Card>

          {/* Existing holidays card */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Holidays</CardTitle>
              <CardDescription>
                {holidays.length} holiday{holidays.length !== 1 ? "s" : ""} configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : holidays.length === 0 ? (
                <p className="text-muted-foreground italic">No holidays added yet.</p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell>
                            {format(new Date(holiday.date + "T00:00:00"), "EEE, MMM do yyyy")}
                          </TableCell>
                          <TableCell>{holiday.name}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(holiday.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default HolidaysPage;
