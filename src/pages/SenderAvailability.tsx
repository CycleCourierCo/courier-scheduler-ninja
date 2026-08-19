
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { updateSenderAvailability } from '@/services/availabilityService';
import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityForm } from '@/components/availability/AvailabilityForm';
import { LoadingState, ErrorState } from '@/components/availability/AvailabilityStatus';
import { ConfirmedDatesView } from '@/components/availability/ConfirmedDatesView';
import { getPublicOrder } from '@/services/fetchOrderService';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CalendarClock } from 'lucide-react';
import { describeOpeningWindows, getNextOpenDays, normaliseOpeningHours } from '@/lib/businessAvailability';


export default function SenderAvailability() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [paramError, setParamError] = useState<string | null>(null);
  const [initialCheckCompleted, setInitialCheckCompleted] = useState(false);
  
  // Log the route params and domain info for debugging
  useEffect(() => {
    console.log("=== SENDER AVAILABILITY COMPONENT ===");
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
    confirmedNotes
  } = useAvailability({
    type: 'sender',
    updateFunction: updateSenderAvailability,
    getMinDate: () => new Date(),
    isAlreadyConfirmed: (order) => {
      if (!order) return false;
      return (order.pickupDate !== undefined && order.pickupDate !== null && 
              Array.isArray(order.pickupDate) && order.pickupDate.length > 0);
    }
  });
  const { userProfile } = useAuth();
  const [mode, setMode] = useState<'unset' | 'now' | 'later'>('unset');

  const openingHours = useMemo(
    () => normaliseOpeningHours(userProfile?.opening_hours),
    [userProfile?.opening_hours]
  );

  // The logged-in business account is the sender when the order's sender contact matches their profile
  const isBusinessSender = useMemo(() => {
    if (!order || !userProfile) return false;
    const isBusiness = Boolean(userProfile.is_business);
    if (!isBusiness) return false;

    const senderEmail = (order as any)?.sender?.email?.toLowerCase?.().trim();
    if (!senderEmail) return false;

    const candidates = [userProfile.email, userProfile.accounts_email]
      .filter(Boolean)
      .map((value: string) => value.toLowerCase().trim());

    return candidates.includes(senderEmail);
  }, [order, userProfile]);

  const handleAvailableNow = () => {
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
          title="Pickup Availability"
          dates={confirmedDates}
          notes={confirmedNotes}
        />
      </Layout>
    );
  }

  if (isBusinessSender && mode === 'unset') {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="space-y-1 bg-slate-50 rounded-t-lg border-b">
              <CardTitle className="text-2xl">Is the bike ready for collection?</CardTitle>
              <CardDescription>
                Choose an option so we can schedule your collection straight away.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleAvailableNow}
                className="text-left rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-primary" />
                  Bike is available now
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Collect any time within our business hours. We'll use your opening hours to pick
                  the next 7 available days — you can adjust them before submitting.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('later')}
                className="text-left rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent"
              >
                <div className="flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Bike isn't available yet
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pick the dates the bike will be ready for collection.
                </p>
              </button>
            </CardContent>
          </Card>
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              I'll do this later
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AvailabilityForm
        title={mode === 'now' ? "Confirm Collection Days" : "Confirm Your Availability"}
        description={
          mode === 'now'
            ? "These days come from your business opening hours — adjust them if needed, then submit."
            : "Select dates when you will be available for package pickup"
        }
        dates={dates}
        setDates={setDates}
        notes={notes}
        setNotes={setNotes}
        postcode={postcode}
        setPostcode={setPostcode}
        postcodeLabel="Pickup postcode"
        placeholder="Add any special instructions for pickup (optional)"
        minDate={minDate}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        isDateDisabled={isDateDisabled}
        calendarEndDate={calendarEndDate}
        altLocation={altLocation}
        setAltLocation={setAltLocation}
        showAltLocation={!isBusinessSender}
        altMode="collection"
      />
    </Layout>

  );

}
