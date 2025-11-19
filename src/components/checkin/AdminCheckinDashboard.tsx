import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, CheckCircle, XCircle, MinusCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { checkinService } from '@/services/checkinService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function AdminCheckinDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: driversStatus, isLoading } = useQuery({
    queryKey: ['admin-checkin-status', format(selectedDate, 'yyyy-MM-dd')],
    queryFn: () => checkinService.getAllDriversCheckinStatus(format(selectedDate, 'yyyy-MM-dd'))
  });

  const stats = {
    total: driversStatus?.length || 0,
    checkedIn: driversStatus?.filter(d => d.checkin).length || 0,
    onTime: driversStatus?.filter(d => d.checkin?.is_on_time).length || 0,
    late: driversStatus?.filter(d => d.checkin && !d.checkin.is_on_time).length || 0
  };

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Checked In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.checkedIn}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">On Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.onTime}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.late}</div>
          </CardContent>
        </Card>
      </div>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Check-In Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Photos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driversStatus?.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">{driver.name || 'N/A'}</TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>
                      {!driver.checkin ? (
                        <Badge variant="secondary" className="gap-1">
                          <MinusCircle className="h-3 w-3" />
                          Not Checked In
                        </Badge>
                      ) : driver.checkin.is_on_time ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          On Time
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Late
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {driver.checkin?.checkin_time || '-'}
                    </TableCell>
                    <TableCell>
                      {driver.checkin && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>
                                {driver.name} - {format(selectedDate, 'MMM dd, yyyy')}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium mb-2">Fuel Level</p>
                                <img
                                  src={driver.checkin.fuel_photo_url}
                                  alt="Fuel level"
                                  className="w-full rounded-lg border"
                                />
                              </div>
                              <div>
                                <p className="text-sm font-medium mb-2">Uniform</p>
                                <img
                                  src={driver.checkin.uniform_photo_url}
                                  alt="Uniform"
                                  className="w-full rounded-lg border"
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
