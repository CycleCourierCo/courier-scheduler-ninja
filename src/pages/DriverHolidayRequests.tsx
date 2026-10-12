import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnavailableDatesEditor } from "@/components/rota/UnavailableDatesEditor";

const DriverHolidayRequests = () => {
  const { user, userProfile } = useAuth();
  const inactive = userProfile?.is_active === false;

  if (inactive) {
    return <Layout><div className="container mx-auto px-4 py-10"><Card><CardContent className="p-6">Your account is inactive, so you can't change your availability.</CardContent></Card></div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-3xl font-bold">My availability</h1>
          <p className="text-muted-foreground">Mark the dates you can't work — it takes effect straight away, no approval needed.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Days you can't work</CardTitle>
            <CardDescription>Pick dates on the calendar and save. Remove a date any time to become available again.</CardDescription>
          </CardHeader>
          <CardContent>
            {user && <UnavailableDatesEditor driverId={user.id} />}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DriverHolidayRequests;
