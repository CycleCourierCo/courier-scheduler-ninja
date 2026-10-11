import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Calendar, FileText, Truck, Plus } from 'lucide-react';
import MechanicTimeslipCard from '@/components/timeslips/MechanicTimeslipCard';
import { timeslipService } from '@/services/timeslipService';
import { Timeslip } from '@/types/timeslip';
import {
  listAllMechanicTimeslips,
  updateMechanicTimeslip,
  deleteMechanicTimeslip,
  MechanicTimeslip,
} from '@/services/mechanicTimeslipService';
import { getMechanicWorkByDate, DayWork } from '@/services/mechanicWorkService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { hasRole } from '@/lib/roles';
import Layout from '@/components/Layout';
import DashboardHeader from '@/components/DashboardHeader';
import TimeslipCard from '@/components/timeslips/TimeslipCard';
import TimeslipEditDialog from '@/components/timeslips/TimeslipEditDialog';
import GenerateTimeslipsDialog from '@/components/timeslips/GenerateTimeslipsDialog';
import BulkAssignVehicleDialog from '@/components/timeslips/BulkAssignVehicleDialog';
import CreateTimeslipDialog, { CreateTimeslipInput } from '@/components/timeslips/CreateTimeslipDialog';
import TimeslipFilters from '@/components/timeslips/TimeslipFilters';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type MergedTimeslip =
  | { kind: 'driver'; slip: Timeslip }
  | { kind: 'mechanic'; slip: MechanicTimeslip };

interface MechanicEditState {
  slip: MechanicTimeslip;
  hourly_rate: number;
  lunch_hours: number;
  admin_notes: string;
  status: MechanicTimeslip['status'];
  clock_in_at: string;
  clock_out_at: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Mechanic statuses that belong on each driver-timeslip tab. */
const mechanicStatusesForTab = (tab: string): string[] | undefined => {
  if (tab === 'draft') return ['open', 'closed'];
  if (tab === 'approved') return ['approved'];
  return undefined; // 'all'
};

const DriverTimeslips = () => {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [editingTimeslip, setEditingTimeslip] = useState<Timeslip | null>(null);
  const [editingMechanic, setEditingMechanic] = useState<MechanicEditState | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showBulkVehicleDialog, setShowBulkVehicleDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingTimeslipId, setDeletingTimeslipId] = useState<string | null>(null);
  const [deletingMechanicId, setDeletingMechanicId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('draft');
  const [filters, setFilters] = useState<{
    driverId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy: string;
    noMileage?: boolean;
    noVehicle?: boolean;
  }>({
    sortBy: 'date_desc',
  });

  const isTrueAdmin = hasRole(userProfile, 'admin');
  const isAdmin = isTrueAdmin || hasRole(userProfile, 'timeslip_admin');

  const dateFromStr = filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : undefined;
  const dateToStr = filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : undefined;

  // Fetch all timeslips for accurate counts (no status filter)
  const { data: allTimeslips } = useQuery({
    queryKey: ['timeslips', 'counts', filters.driverId, filters.dateFrom, filters.dateTo, filters.noMileage, filters.noVehicle],
    queryFn: () => {
      if (isAdmin) {
        return timeslipService.getAllTimeslips({
          status: undefined, // Get all statuses for accurate counts
          driverId: filters.driverId,
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          noMileage: filters.noMileage,
          noVehicle: filters.noVehicle,
        });
      }
      return [];
    },
    enabled: isAdmin,
  });

  // All mechanic timeslips for counts (driver/date filters apply; driver-only toggles don't)
  const { data: allMechanicSlips } = useQuery({
    queryKey: ['mechanic-timeslips', 'counts', filters.driverId, dateFromStr, dateToStr],
    queryFn: () =>
      listAllMechanicTimeslips({
        driverId: filters.driverId,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
      }),
    enabled: isAdmin,
  });

  // Fetch timeslips based on user role and active tab
  const { data: timeslips, isLoading } = useQuery({
    queryKey: ['timeslips', activeTab, filters.driverId, filters.dateFrom, filters.dateTo, filters.noMileage, filters.noVehicle],
    queryFn: () => {
      if (isAdmin) {
        return timeslipService.getAllTimeslips({
          status: activeTab === 'all' ? undefined : (activeTab as 'draft' | 'approved' | 'rejected'),
          driverId: filters.driverId,
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          noMileage: filters.noMileage,
          noVehicle: filters.noVehicle,
        });
      }
      // For drivers, fetch only approved timeslips
      return timeslipService.getDriverTimeslips(userProfile?.id || '');
    },
  });

  // Mechanic timeslips for the active tab
  const { data: mechanicSlips, isLoading: isLoadingMechanic } = useQuery({
    queryKey: ['mechanic-timeslips', activeTab, filters.driverId, dateFromStr, dateToStr],
    queryFn: () =>
      listAllMechanicTimeslips({
        statusIn: mechanicStatusesForTab(activeTab),
        driverId: filters.driverId,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
      }),
    enabled: isAdmin,
  });

  // Work done per mechanic slip, indexed by "driverId:date".
  const { data: workBySlip } = useQuery({
    queryKey: ['mechanic-work-admin', (mechanicSlips || []).map((s) => `${s.driver_id}:${s.date}`).join('|')],
    queryFn: async () => {
      const rows = mechanicSlips || [];
      const datesByDriver = new Map<string, Set<string>>();
      rows.forEach((s) => {
        if (!datesByDriver.has(s.driver_id)) datesByDriver.set(s.driver_id, new Set());
        datesByDriver.get(s.driver_id)!.add(s.date);
      });
      const out: Record<string, DayWork> = {};
      await Promise.all(
        Array.from(datesByDriver.entries()).map(async ([driverId, dates]) => {
          const byDate = await getMechanicWorkByDate(driverId, Array.from(dates));
          Object.entries(byDate).forEach(([date, work]) => {
            out[`${driverId}:${date}`] = work;
          });
        })
      );
      return out;
    },
    enabled: isAdmin && !!mechanicSlips && mechanicSlips.length > 0,
  });

  // Merge driver + mechanic timeslips and sort
  const sortedTimeslips = useMemo(() => {
    const merged: MergedTimeslip[] = [
      ...(timeslips || []).map((slip): MergedTimeslip => ({ kind: 'driver', slip })),
      ...(isAdmin ? (mechanicSlips || []).map((slip): MergedTimeslip => ({ kind: 'mechanic', slip })) : []),
    ];
    const dateOf = (m: MergedTimeslip) => new Date(m.slip.date).getTime();
    const nameOf = (m: MergedTimeslip) => m.slip.driver?.name || '';
    const payOf = (m: MergedTimeslip) => m.slip.total_pay || 0;

    switch (filters.sortBy) {
      case 'date_asc':
        return merged.sort((a, b) => dateOf(a) - dateOf(b));
      case 'driver_name':
        return merged.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      case 'total_pay_desc':
        return merged.sort((a, b) => payOf(b) - payOf(a));
      case 'total_pay_asc':
        return merged.sort((a, b) => payOf(a) - payOf(b));
      default: // date_desc
        return merged.sort((a, b) => dateOf(b) - dateOf(a));
    }
  }, [timeslips, mechanicSlips, isAdmin, filters.sortBy]);

  // Generate timeslips mutation
  const generateMutation = useMutation({
    mutationFn: (date: Date) => timeslipService.generateTimeslips(format(date, 'yyyy-MM-dd')),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timeslips'] });
      setShowGenerateDialog(false);

      if (data.count === 0) {
        toast.info("No completed orders found in Shipday for this date");
      } else {
        toast.success(`Generated ${data.count} draft timeslip${data.count !== 1 ? 's' : ''}`);
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to generate timeslips: ${error.message}`);
    },
  });

  // Update timeslip mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Timeslip> }) =>
      timeslipService.updateTimeslip(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslips'] });
      toast.success('Timeslip updated successfully');
    },
    onError: () => {
      toast.error('Failed to update timeslip');
    },
  });

  // Approve timeslip mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => timeslipService.approveTimeslip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslips'] });
      toast.success('Timeslip approved');
    },
    onError: () => {
      toast.error('Failed to approve timeslip');
    },
  });

  // Reject timeslip mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => timeslipService.rejectTimeslip(id, 'Rejected by admin'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslips'] });
      toast.success('Timeslip rejected');
    },
    onError: () => {
      toast.error('Failed to reject timeslip');
    },
  });


  // Delete timeslip mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => timeslipService.deleteTimeslip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslips'] });
      toast.success('Timeslip deleted');
      setDeletingTimeslipId(null);
    },
    onError: () => {
      toast.error('Failed to delete timeslip');
    },
  });

  // Create timeslip mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateTimeslipInput) => timeslipService.createTimeslip(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeslips'] });
      toast.success('Timeslip created');
      setShowCreateDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to create timeslip: ${error.message}`);
    },
  });

  // Mechanic timeslip mutations
  const mechanicUpdateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => updateMechanicTimeslip(id, updates),
    onSuccess: () => {
      toast.success('Updated');
      queryClient.invalidateQueries({ queryKey: ['mechanic-timeslips'] });
      setEditingMechanic(null);
    },
    onError: (e: any) => toast.error(e.message || 'Update failed'),
  });

  const mechanicDeleteMut = useMutation({
    mutationFn: (id: string) => deleteMechanicTimeslip(id),
    onSuccess: () => {
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['mechanic-timeslips'] });
      setDeletingMechanicId(null);
    },
    onError: (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const handleGenerate = (date: Date) => {
    generateMutation.mutate(date);
  };

  const handleEdit = (timeslip: Timeslip) => {
    setEditingTimeslip(timeslip);
  };

  const handleSave = (id: string, updates: Partial<Timeslip>) => {
    updateMutation.mutate({ id, updates });
    setEditingTimeslip(null);
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id);
  };


  const handleDelete = (id: string) => {
    setDeletingTimeslipId(id);
  };

  const confirmDelete = () => {
    if (deletingTimeslipId) {
      deleteMutation.mutate(deletingTimeslipId);
    }
  };

  const handleMechanicEdit = (slip: MechanicTimeslip) => {
    setEditingMechanic({
      slip,
      hourly_rate: Number(slip.hourly_rate),
      lunch_hours: Number(slip.lunch_hours),
      admin_notes: slip.admin_notes || '',
      status: slip.status,
      clock_in_at: toLocalInput(slip.clock_in_at),
      clock_out_at: toLocalInput(slip.clock_out_at),
    });
  };

  const saveMechanicEdit = () => {
    if (!editingMechanic) return;
    const clockIn = fromLocalInput(editingMechanic.clock_in_at);
    if (!clockIn) {
      toast.error('Clock in time is required');
      return;
    }
    const clockOut = fromLocalInput(editingMechanic.clock_out_at);
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) {
      toast.error('Clock out must be after clock in');
      return;
    }
    mechanicUpdateMut.mutate({
      id: editingMechanic.slip.id,
      updates: {
        hourly_rate: editingMechanic.hourly_rate,
        lunch_hours: editingMechanic.lunch_hours,
        admin_notes: editingMechanic.admin_notes || null,
        status: editingMechanic.status,
        clock_in_at: clockIn,
        clock_out_at: clockOut,
      },
    });
  };

  const deletingTimeslip = allTimeslips?.find(t => t.id === deletingTimeslipId) ||
                           timeslips?.find(t => t.id === deletingTimeslipId);
  const deletingMechanicSlip = allMechanicSlips?.find(t => t.id === deletingMechanicId) ||
                               mechanicSlips?.find(t => t.id === deletingMechanicId);

  // Count timeslips by status (from all timeslips for accurate counts)
  const draftCount = (allTimeslips?.filter((t) => t.status === 'draft').length || 0) +
    (allMechanicSlips?.filter((t) => t.status === 'open' || t.status === 'closed').length || 0);
  const approvedCount = (allTimeslips?.filter((t) => t.status === 'approved').length || 0) +
    (allMechanicSlips?.filter((t) => t.status === 'approved').length || 0);
  const allCount = (allTimeslips?.length || 0) + (allMechanicSlips?.length || 0);

  // Calculate total pay from visible timeslips
  const totalPay = useMemo(() => {
    if (!sortedTimeslips) return 0;
    return sortedTimeslips.reduce((sum, item) => sum + (item.slip.total_pay || 0), 0);
  }, [sortedTimeslips]);

  const pageLoading = isLoading || (isAdmin && isLoadingMechanic);

  const renderGrid = (items: MergedTimeslip[]) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) =>
        item.kind === 'driver' ? (
          <TimeslipCard
            key={`d-${item.slip.id}`}
            timeslip={item.slip}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
          />
        ) : (
          <MechanicTimeslipCard
            key={`m-${item.slip.id}`}
            slip={item.slip}
            work={workBySlip?.[`${item.slip.driver_id}:${item.slip.date}`]}
            actionPending={mechanicUpdateMut.isPending}
            onApprove={(id) => mechanicUpdateMut.mutate({ id, updates: { status: 'approved' } })}
            onReject={(id) => mechanicUpdateMut.mutate({ id, updates: { status: 'rejected' } })}
            onEdit={handleMechanicEdit}
            onDelete={setDeletingMechanicId}
          />
        )
      )}
    </div>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6 min-w-0 max-w-full overflow-x-hidden">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isAdmin ? 'Timeslips' : 'My Timeslips'}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? 'Manage timeslips and payments'
                : 'View your approved timeslips'}
            </p>
          </div>
        </DashboardHeader>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowGenerateDialog(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Generate Timeslips
            </Button>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Timeslip
            </Button>
            <Button variant="outline" onClick={() => setShowBulkVehicleDialog(true)}>
              <Truck className="h-4 w-4 mr-2" />
              Bulk Assign Vehicle
            </Button>
          </div>
        )}

        {isAdmin && (
          <TimeslipFilters onFilterChange={setFilters} />
        )}

        {isAdmin && sortedTimeslips && sortedTimeslips.length > 0 && (
          <Card>
            <CardContent className="flex flex-wrap justify-between items-center gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">Showing</p>
                <p className="text-2xl font-bold">{sortedTimeslips.length} timeslips</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Pay</p>
                <p className="text-2xl font-bold text-green-600">
                  £{totalPay.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="w-full overflow-x-auto">
              <TabsList className="inline-flex w-max">
                <TabsTrigger value="draft">
                  <FileText className="h-4 w-4 mr-2" />
                  Draft ({draftCount})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({approvedCount})
                </TabsTrigger>
                <TabsTrigger value="all">All ({allCount})</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="space-y-4">
              {pageLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">Loading timeslips...</p>
                  </CardContent>
                </Card>
              ) : sortedTimeslips && sortedTimeslips.length > 0 ? (
                renderGrid(sortedTimeslips)
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">
                      No timeslips found. Generate timeslips for a specific date to get started.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div>
            {pageLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">Loading timeslips...</p>
                </CardContent>
              </Card>
            ) : sortedTimeslips && sortedTimeslips.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedTimeslips.map((item) =>
                  item.kind === 'driver' ? (
                    <TimeslipCard
                      key={`d-${item.slip.id}`}
                      timeslip={item.slip}
                      isAdmin={false}
                    />
                  ) : null
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    No approved timeslips yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <TimeslipEditDialog
        timeslip={editingTimeslip}
        isOpen={!!editingTimeslip}
        onClose={() => setEditingTimeslip(null)}
        onSave={handleSave}
      />

      <GenerateTimeslipsDialog
        isOpen={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onGenerate={handleGenerate}
      />

      <BulkAssignVehicleDialog
        isOpen={showBulkVehicleDialog}
        onClose={() => setShowBulkVehicleDialog(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['timeslips'] })}
      />

      <CreateTimeslipDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={(input) => createMutation.mutate(input)}
        submitting={createMutation.isPending}
      />

      <AlertDialog open={!!deletingTimeslipId} onOpenChange={(open) => !open && setDeletingTimeslipId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timeslip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timeslip for{' '}
              <strong>{deletingTimeslip?.driver?.name || 'Unknown Driver'}</strong> on{' '}
              <strong>{deletingTimeslip ? format(new Date(deletingTimeslip.date), 'MMMM d, yyyy') : ''}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mechanic edit dialog */}
      <Dialog open={!!editingMechanic} onOpenChange={(o) => !o && setEditingMechanic(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit mechanic timeslip</DialogTitle></DialogHeader>
          {editingMechanic && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Clock in</Label>
                  <Input type="datetime-local" value={editingMechanic.clock_in_at}
                    onChange={(e) => setEditingMechanic({ ...editingMechanic, clock_in_at: e.target.value })} />
                </div>
                <div>
                  <Label>Clock out</Label>
                  <Input type="datetime-local" value={editingMechanic.clock_out_at}
                    onChange={(e) => setEditingMechanic({ ...editingMechanic, clock_out_at: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Clear to reopen the shift.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hourly rate (£)</Label>
                  <Input type="number" step="0.25" value={editingMechanic.hourly_rate}
                    onChange={(e) => setEditingMechanic({ ...editingMechanic, hourly_rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Lunch hours</Label>
                  <Input type="number" step="0.25" value={editingMechanic.lunch_hours}
                    onChange={(e) => setEditingMechanic({ ...editingMechanic, lunch_hours: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingMechanic.status} onValueChange={(v) => setEditingMechanic({ ...editingMechanic, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Admin notes</Label>
                <Textarea rows={3} value={editingMechanic.admin_notes}
                  onChange={(e) => setEditingMechanic({ ...editingMechanic, admin_notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingMechanic(null)}>Cancel</Button>
            <Button onClick={saveMechanicEdit} disabled={mechanicUpdateMut.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mechanic delete dialog */}
      <Dialog open={!!deletingMechanicId} onOpenChange={(o) => !o && setDeletingMechanicId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete timeslip?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete the mechanic timeslip for{' '}
            <strong>{deletingMechanicSlip?.driver?.name || deletingMechanicSlip?.driver?.email || 'Unknown'}</strong> on{' '}
            <strong>{deletingMechanicSlip ? format(new Date(deletingMechanicSlip.date), 'MMMM d, yyyy') : ''}</strong>?
            This cannot be undone.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDeletingMechanicId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingMechanicId && mechanicDeleteMut.mutate(deletingMechanicId)} disabled={mechanicDeleteMut.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default DriverTimeslips;
