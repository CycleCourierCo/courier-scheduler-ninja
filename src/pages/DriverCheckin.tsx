import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import DashboardHeader from '@/components/DashboardHeader';
import { useAuth } from '@/contexts/AuthContext';
import { checkinService } from '@/services/checkinService';
import { CheckinForm } from '@/components/checkin/CheckinForm';
import { CheckinHistory } from '@/components/checkin/CheckinHistory';
import { WeeklyComplianceCard } from '@/components/checkin/WeeklyComplianceCard';
import { AdminCheckinDashboard } from '@/components/checkin/AdminCheckinDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Clock, CheckCircle } from 'lucide-react';

export default function DriverCheckin() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm:ss'));

  // Update time every second
  useState(() => {
    const interval = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(interval);
  });

  // Driver queries
  const { data: todayCheckin } = useQuery({
    queryKey: ['today-checkin', userProfile?.id],
    queryFn: () => userProfile?.id ? checkinService.getTodayCheckin(userProfile.id) : null,
    enabled: isDriver && !!userProfile?.id
  });

  const { data: checkinHistory } = useQuery({
    queryKey: ['checkin-history', userProfile?.id],
    queryFn: () => userProfile?.id ? checkinService.getCheckinHistory(userProfile.id) : [],
    enabled: isDriver && !!userProfile?.id
  });

  const { data: weeklyStats } = useQuery({
    queryKey: ['weekly-stats', userProfile?.id],
    queryFn: () => userProfile?.id ? checkinService.getCurrentWeekStats(userProfile.id) : null,
    enabled: isDriver && !!userProfile?.id
  });

  const { data: weeklyBonuses } = useQuery({
    queryKey: ['weekly-bonuses', userProfile?.id],
    queryFn: () => userProfile?.id ? checkinService.getWeeklyBonuses(userProfile.id) : [],
    enabled: isDriver && !!userProfile?.id
  });

  // Submit check-in mutation
  const submitCheckinMutation = useMutation({
    mutationFn: async ({ fuelPhoto, uniformPhoto }: { fuelPhoto: File; uniformPhoto: File }) => {
      if (!userProfile?.id) throw new Error('User not found');
      return checkinService.submitCheckin(userProfile.id, fuelPhoto, uniformPhoto);
    },
    onSuccess: () => {
      toast.success('Check-in submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['today-checkin'] });
      queryClient.invalidateQueries({ queryKey: ['checkin-history'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit check-in');
    }
  });

  const handleSubmitCheckin = async (fuelPhoto: File, uniformPhoto: File) => {
    await submitCheckinMutation.mutateAsync({ fuelPhoto, uniformPhoto });
  };

  const hasCheckedInToday = !!todayCheckin;
  const isPastDeadline = currentTime > '08:15:00';

  if (!isDriver && !isAdmin) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <p className="text-center text-muted-foreground">
            This page is only accessible to drivers and administrators.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Driver Check-In</h1>
            <p className="text-muted-foreground">
              {isDriver ? "Submit your daily fuel and uniform photos" : "Monitor driver check-ins"}
            </p>
          </div>
        </DashboardHeader>

        {isAdmin ? (
          <Tabs defaultValue="today" className="space-y-6">
            <TabsList>
              <TabsTrigger value="today">Today's Check-Ins</TabsTrigger>
              <TabsTrigger value="weekly">Weekly Bonuses</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-6">
              <AdminCheckinDashboard />
            </TabsContent>

            <TabsContent value="weekly" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Bonus Management</CardTitle>
                  <CardDescription>
                    Bonuses are automatically calculated each Monday for the previous week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Weekly bonus feature coming soon. Drivers with 80%+ on-time check-ins will receive a £50 bonus.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* Current Time & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Current Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{currentTime}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Deadline: 08:15:00 {isPastDeadline && '(Passed)'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {hasCheckedInToday ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-600">Checked In</p>
                        <p className="text-sm text-muted-foreground">
                          at {todayCheckin.checkin_time}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-amber-600">Not Checked In</p>
                      <p className="text-sm text-muted-foreground">
                        Please submit your check-in
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Check-In Form or Weekly Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {!hasCheckedInToday ? (
                <CheckinForm
                  onSubmit={handleSubmitCheckin}
                  isSubmitting={submitCheckinMutation.isPending}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Today's Check-In Complete</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Fuel Level</p>
                        <img
                          src={todayCheckin.fuel_photo_url}
                          alt="Fuel level"
                          className="w-full rounded-lg border"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Uniform</p>
                        <img
                          src={todayCheckin.uniform_photo_url}
                          alt="Uniform"
                          className="w-full rounded-lg border"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {weeklyStats && (
                <WeeklyComplianceCard
                  totalCheckins={weeklyStats.total_checkins}
                  onTimeCheckins={weeklyStats.on_time_checkins}
                  compliancePercentage={Number(weeklyStats.compliance_percentage)}
                />
              )}
            </div>

            {/* Weekly Bonuses */}
            {weeklyBonuses && weeklyBonuses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Weekly Bonuses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {weeklyBonuses.map((bonus) => (
                      <div
                        key={bonus.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium">
                            {format(new Date(bonus.week_start_date), 'MMM dd')} - {format(new Date(bonus.week_end_date), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {bonus.compliance_percentage.toFixed(0)}% compliance ({bonus.on_time_checkins}/{bonus.total_checkins} on time)
                          </p>
                        </div>
                        {bonus.bonus_awarded && (
                          <div className="text-right">
                            <p className="font-bold text-green-600">£50</p>
                            <p className="text-xs text-muted-foreground">Bonus Awarded</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Check-In History */}
            {checkinHistory && <CheckinHistory checkins={checkinHistory} />}
          </>
        )}
      </div>
    </Layout>
  );
}
