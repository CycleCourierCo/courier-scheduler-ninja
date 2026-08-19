
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { updateReceiverAvailability } from '@/services/availabilityService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';
import { ConfirmedDatesView } from '@/components/availability/ConfirmedDatesView';
import { toast } from 'sonner';
import { getPublicOrder } from '@/services/fetchOrderService';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CalendarClock } from 'lucide-react';
import { describeOpeningWindows, getNextOpenDays, normaliseOpeningHours } from '@/lib/businessAvailability';

export default function ReceiverAvailability() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paramError, setParamError] = useState<string | null>(null);
  const [initialCheckCompleted, setInitialCheckCompleted] = useState(false);
  
  // Log the route params and domain info for debugging
  useEffect(() => {
    console.log("=== RECEIVER AVAILABILITY COMPONENT ===");
    console.log("Current domain:", window.location.origin);
    console.log("Full URL:", window.location.href);
    console.log("Route params:", params);
    console.log("ID param:", params.id);
    
    // Validate if ID param exists
    if (!params.id) {
      console.error("Missing ID parameter in the URL");
      setParamError("Missing order ID in the URL. Please check your link and try again.");
    } else {
      // Verify that the order exists directly (extra validation)
      getPublicOrder(params.id)
        .then(order => {
          if (!order) {
            console.error(`Order with ID ${params.id} not found`);
            setParamError(`Order with ID ${params.id} was not found. Please check your link and try again.`);
          }
          setInitialCheckCompleted(true);
        })
        .catch(err => {
          console.error("Error pre-fetching order:", err);
          setParamError("Error loading order information. Please try again later.");
          setInitialCheckCompleted(true);
        });
    }
  }, [params]);

  const {
    dates,
    setDates,
    notes,
    setNotes,
    postcode,
    setPostcode,
    altLocation,
    setAltLocation,

    isLoading,
    isSubmitting,
    order,
    error,
    minDate,
    navigate: hookNavigate,
    handleSubmit,
    isDateDisabled,
    calendarEndDate,
    isConfirmed,
    confirmedDates,
    confirmedNotes,
    hasInspectionBuffer
  } = useAvailability({
    type: 'receiver',
    updateFunction: updateReceiverAvailability,
    getMinDate: () => new Date(),
    isAlreadyConfirmed: (order) => {
      if (!order) return false;
      return (order.deliveryDate !== undefined && order.deliveryDate !== null && 
              Array.isArray(order.deliveryDate) && order.deliveryDate.length > 0);
    }
  });

  const { userProfile } = useAuth();
  const [mode, setMode] = useState<'unset' | 'now' | 'later'>('unset');

  // Resolved server-side in the public order payload so the emailed link works
  // without signing in. Falls back to the signed-in profile.
  const isBusinessReceiver = useMemo(() => {
    if (order?.receiverIsBusiness) return true;
    if (!order || !userProfile?.is_business) return false;
    const receiverEmail = (order as any)?.receiver?.email?.toLowerCase?.().trim();
    if (!receiverEmail) return false;
    const candidates = [userProfile.email, userProfile.accounts_email]
      .filter(Boolean)
      .map((value: string) => value.toLowerCase().trim());
    return candidates.includes(receiverEmail);
  }, [order, userProfile]);

  const openingHours = useMemo(
    () => normaliseOpeningHours(order?.receiverOpeningHours ?? userProfile?.opening_hours),
    [order?.receiverOpeningHours, userProfile?.opening_hours]
  );

  const handleBusinessHours = () => {
    const openDays = getNextOpenDays(openingHours, 7, isDateDisabled);
    setDates(openDays);
    const summary = describeOpeningWindows(openingHours, openDays);
    setNotes(notes ? `${notes}\n\n${summary}` : summary);
    setMode('now');
  };

  if (paramError) {
    return (
      <Layout>
        <ErrorState 
          error={paramError} 
          onHome={() => navigate("/")} 
        />
      </Layout>
    );
  }

  if (!initialCheckCompleted || isLoading) {
    return (
      <Layout>
        <LoadingState message="Loading order details..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorState 
          error={error} 
          onHome={() => navigate("/")} 
        />
      </Layout>
    );
  }

  if (isConfirmed) {
    return (
      <Layout>
        <ConfirmedDatesView
          title="Delivery Availability"
          dates={confirmedDates}
          notes={confirmedNotes}
        />
      </Layout>
    );
  }

  // Block the form only while there is outstanding inspection / repair work.
  // Ready cases: repairs completed, all repairs declined, no issues at all, or a
  // released inspection with nothing pending and every approved issue resolved.
  const summary = order?.inspectionSummary;
  const nothingOutstanding =
    !!summary?.inspection_exists &&
    (summary?.pending_count ?? 0) === 0 &&
    (summary?.resolved_count ?? 0) >= (summary?.approved_count ?? 0);
  const inspectionBlocked =
    !!order?.needsInspection &&
    !(
      summary?.repairs_completed_at ||
      summary?.repairs_declined_at ||
      (summary?.inspection_exists && !summary?.has_issues) ||
      nothingOutstanding
    );


  if (inspectionBlocked) {
    return (
      <Layout>
        <ErrorState
          error="This delivery isn't ready to schedule yet — the bike is being inspected and serviced. We'll email you as soon as it's ready so you can pick your delivery dates."
          onHome={() => navigate("/")}
        />
      </Layout>
    );
  }

  if (isBusinessReceiver && mode === 'unset') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="space-y-1 bg-slate-50 rounded-t-lg border-b">
              <CardTitle className="text-2xl">When can we deliver?</CardTitle>
              <CardDescription>
                Choose an option so we can schedule the delivery straight away.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleBusinessHours}
                className="text-left rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-primary" />
                  Deliver during business hours
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  We'll use your opening hours to pick the next 7 available days — you can adjust
                  them before submitting.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('later')}
                className="text-left rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent"
              >
                <div className="flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Pick specific dates
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose the exact dates you can take the delivery.
                </p>
              </button>
            </CardContent>
          </Card>
          {userProfile && (
            <div className="mt-4 text-center">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                I'll do this later
              </Button>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {isBusinessReceiver && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <Button variant="ghost" size="sm" onClick={() => setMode('unset')}>
            ← Back to options
          </Button>
        </div>
      )}
      <AvailabilityForm
        title={mode === 'now' ? 'Confirm Delivery Days' : 'Confirm Your Availability'}
        description={
          mode === 'now'
            ? "These days come from your business opening hours — adjust them if needed, then submit."
            : "Select dates when you will be available for package delivery"
        }
        dates={dates}
        setDates={setDates}
        notes={notes}
        setNotes={setNotes}
        postcode={postcode}
        setPostcode={setPostcode}
        postcodeLabel="Delivery postcode"
        placeholder="Add any special instructions for delivery (optional)"
        minDate={minDate}

        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        isDateDisabled={isDateDisabled}
        calendarEndDate={calendarEndDate}
        altLocation={altLocation}
        setAltLocation={setAltLocation}
        showAltLocation={!isBusinessReceiver}
        altMode="delivery"
        bufferNotice={hasInspectionBuffer
          ? "This bike will be inspected and serviced before delivery, so we've added a short gap between collection and delivery dates. Please pick dates from the earliest available."
          : undefined}
      />
    </Layout>
  );
}
