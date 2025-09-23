import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/Layout";
import { Package, CalendarCheck, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
const features = [{
  title: "Easy Order Creation",
  description: "Create shipping orders in minutes with our intuitive form.",
  icon: <Package className="h-12 w-12 text-courier-500" />
}, {
  title: "Smart Scheduling",
  description: "Automatically coordinate pickup and delivery times between sender and receiver.",
  icon: <CalendarCheck className="h-12 w-12 text-courier-500" />
}];
const Index = () => {
  const {
    user,
    isPasswordReset
  } = useAuth();
  const navigate = useNavigate();

  // Check for password reset hash in URL
  useEffect(() => {
    if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='))) {
      console.log("Password reset hash detected on homepage, redirecting to auth page");
      navigate("/auth?action=resetPassword", {
        replace: true
      });
      toast.info("Please set your new password");
    }
  }, [navigate]);
  return <Layout>
      {/* Hero Section with stunning gradient background filling entire space */}
      <section className="relative flex-1 min-h-[calc(100vh-4rem-10rem)] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-glow/10 rounded-full blur-3xl animate-float" style={{
          animationDelay: '-3s'
        }}></div>
        </div>
        
        <div className="container px-4 md:px-6 relative z-10 mx-auto">
          <div className="flex flex-col items-center space-y-8 text-center justify-center">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl text-gradient">
                Book your Bike 
                <br />
                <span className="text-primary">Delivery</span> now!
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">Streamlining Bike Transport
Fast, friendly and reliable courier services for your business needs</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up justify-center" style={{
            animationDelay: '0.3s'
          }}>
              {user ? <>
                  <Link to="/create-order">
                    <Button variant="premium" size="lg" className="min-w-[200px]">
                      <Package className="mr-2 h-5 w-5" />
                      Create Order
                    </Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button variant="glass" size="lg" className="min-w-[200px]">
                      View Dashboard
                    </Button>
                  </Link>
                </> : <Link to="/auth">
                  <Button variant="premium" size="lg" className="min-w-[250px]">
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In / Sign Up
                  </Button>
                </Link>}
            </div>
          </div>
        </div>
      </section>
    </Layout>;
};
export default Index;