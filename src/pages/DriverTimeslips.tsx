import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, FileText } from 'lucide-react';
import { timeslipService } from '@/services/timeslipService';
import { Timeslip } from '@/types/timeslip';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import DashboardHeader from '@/components/DashboardHeader';
import TimeslipCard from '@/components/timeslips/TimeslipCard';
import TimeslipEditDialog from '@/components/timeslips/TimeslipEditDialog';
import GenerateTimeslipsDialog from '@/components/timeslips/GenerateTimeslipsDialog';
import TimeslipFilters from '@/components/timeslips/TimeslipFilters';
import { format } from 'date-fns';

const DriverTimeslips = () => {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [editingTimeslip, setEditingTimeslip] = useState<Timeslip | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('draft');
  const [filters, setFilters] = useState<{
    driverId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy: string;
  }>({
    sortBy: 'date_desc',
  });

  const isAdmin = userProfile?.role === 'admin';

  // Fetch timeslips based on user role
  const { data: timeslips, isLoading } = useQuery({
    queryKey: ['timeslips', activeTab, filters.driverId, filters.dateFrom, filters.dateTo],
    queryFn: () => {
      if (isAdmin) {
        return timeslipService.getAllTimeslips({
          status: activeTab === 'all' ? undefined : (activeTab as 'draft' | 'approved' | 'rejected'),
          driverId: filters.driverId,
          dateFrom: filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : undefined,
          dateTo: filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : undefined,
        });
      }
      // For drivers, fetch only approved timeslips
      return timeslipService.getDriverTimeslips(userProfile?.id || '');
    },
  });

  // Sort timeslips based on sortBy filter
  const sortedTimeslips = useMemo(() => {
    if (!timeslips) return [];
    const sorted = [...timeslips];

    switch (filters.sortBy) {
      case 'date_asc':
        return sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      case 'driver_name':
        return sorted.sort((a, b) => (a.driver?.name || '').localeCompare(b.driver?.name || ''));
      case 'total_pay_desc':
        return sorted.sort((a, b) => (b.total_pay || 0) - (a.total_pay || 0));
      case 'total_pay_asc':
        return sorted.sort((a, b) => (a.total_pay || 0) - (b.total_pay || 0));
      default: // date_desc
        return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }, [timeslips, filters.sortBy]);

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

  // Count timeslips by status (from sorted list)
  const draftCount = sortedTimeslips?.filter((t) => t.status === 'draft').length || 0;
  const approvedCount = sortedTimeslips?.filter((t) => t.status === 'approved').length || 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isAdmin ? 'Driver Timeslips' : 'My Timeslips'}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? 'Manage driver timeslips and payments'
                : 'View your approved timeslips'}
            </p>
          </div>
        </DashboardHeader>

        {isAdmin && (
          <Button onClick={() => setShowGenerateDialog(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Generate Timeslips
          </Button>
        )}

        {isAdmin && (
          <TimeslipFilters onFilterChange={setFilters} />
        )}

        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="draft">
                <FileText className="h-4 w-4 mr-2" />
                Draft ({draftCount})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedCount})
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">Loading timeslips...</p>
                  </CardContent>
                </Card>
              ) : sortedTimeslips && sortedTimeslips.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sortedTimeslips.map((timeslip) => (
                    <TimeslipCard
                      key={timeslip.id}
                      timeslip={timeslip}
                      isAdmin={isAdmin}
                      onEdit={handleEdit}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
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
            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">Loading timeslips...</p>
                </CardContent>
              </Card>
            ) : sortedTimeslips && sortedTimeslips.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedTimeslips.map((timeslip) => (
                  <TimeslipCard
                    key={timeslip.id}
                    timeslip={timeslip}
                    isAdmin={false}
                  />
                ))}
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
    </Layout>
  );
};

export default DriverTimeslips;
