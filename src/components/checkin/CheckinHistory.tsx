import { DriverCheckin } from '@/types/checkin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CheckinHistoryProps {
  checkins: DriverCheckin[];
}

export function CheckinHistory({ checkins }: CheckinHistoryProps) {
  if (checkins.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check-In History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No check-ins yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check-In History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Photos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkins.map((checkin) => (
              <TableRow key={checkin.id}>
                <TableCell>{format(new Date(checkin.checkin_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="font-medium">{checkin.checkin_time}</TableCell>
                <TableCell>
                  {checkin.is_on_time ? (
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
                          Check-In Photos - {format(new Date(checkin.checkin_date), 'MMM dd, yyyy')}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Fuel Level</p>
                          <img
                            src={checkin.fuel_photo_url}
                            alt="Fuel level"
                            className="w-full rounded-lg border"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Uniform</p>
                          <img
                            src={checkin.uniform_photo_url}
                            alt="Uniform"
                            className="w-full rounded-lg border"
                          />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
