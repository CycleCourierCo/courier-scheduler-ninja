import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import { Package, Wrench, MapPinned, LogIn, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import MyTasksPanel from "@/components/tasks/MyTasksPanel";
import { hasAnyRole } from "@/lib/roles";



const features = [
  { title: "Unboxed, door to door", description: "Specialist bicycle collection and delivery across the UK and Ireland.", icon: Package },
  { title: "Inspection and repair en route", description: "Workshop inspection, clear approval links and one connected journey.", icon: Wrench },
  { title: "Tracking your buyer can follow", description: "Every stage, date and next step shown in one clear route.", icon: MapPinned },
];

const Index = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const isStaff = hasAnyRole(userProfile, [
    'admin', 'loader', 'mechanic', 'driver', 'route_planner', 'sales', 'timeslip_admin', 'cs_agent',
  ]);


  // Safety net: forward malformed reset links that land on "/" to /reset-password.
  useEffect(() => {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const hasRecovery =
      search.includes("token_hash=") ||
      /[?&]type=recovery(?:&|$)/.test(search) ||
      hash.includes("access_token=") ||
      hash.includes("type=recovery");
    if (hasRecovery) {
      const incoming = new URLSearchParams(search.replace(/^\?/, ""));
      const forward = new URLSearchParams();
      const tokenHash = incoming.get("token_hash");
      const type = incoming.get("type") || "recovery";
      if (tokenHash) forward.set("token_hash", tokenHash);
      forward.set("type", type);
      const qs = forward.toString();
      navigate(`/reset-password${qs ? `?${qs}` : ""}${hash}`, { replace: true });
    }
  }, [navigate]);



  return (
    <Layout>
      <section className="bg-primary py-12 text-primary-foreground md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold uppercase"><MapPinned className="h-5 w-5" /> Specialist bicycle transport</p>
            <h1 className="max-w-3xl text-[40px] font-extrabold leading-[1.1] text-primary-foreground md:text-6xl">Book your bike delivery now!</h1>
            <p className="mt-5 max-w-2xl text-lg text-primary-foreground/90">Fast, friendly and reliable door-to-door bicycle collection, delivery and tracking.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <>
                  <Button asChild size="lg" className="min-w-[200px] bg-card text-foreground hover:bg-card/90"><Link to="/create-order">
                      <Package className="mr-2 h-5 w-5" />
                      Create Order
                  </Link></Button>
                  <Button asChild variant="outline" size="lg" className="min-w-[200px] border-primary-foreground bg-transparent text-primary-foreground hover:bg-card hover:text-foreground"><Link to="/dashboard">View Dashboard <ArrowRight /></Link></Button>
                </>
              ) : (
                <Button asChild size="lg" className="min-w-[250px] bg-card text-foreground hover:bg-card/90"><Link to="/auth">
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In / Sign Up
                </Link></Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-4 md:px-6">
        <div className="divide-y border-y">
          {features.map(({ title, description, icon: Icon }) => (
            <div key={title} className="grid gap-3 py-6 sm:grid-cols-[48px_1fr_2fr] sm:items-center">
              <Icon className="h-7 w-7 text-primary" />
              <h2 className="text-lg">{title}</h2>
              <p className="text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {user && isStaff && (
        <section className="container mx-auto px-4 md:px-6 pb-10">
          <MyTasksPanel />
        </section>
      )}
    </Layout>
  );
};


export default Index;