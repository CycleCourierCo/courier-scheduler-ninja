
import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/Layout";
import { Package, CalendarCheck, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const features = [
  {
    title: "Easy Order Creation",
    description: "Create shipping orders in minutes with our intuitive form.",
    icon: <Package className="h-12 w-12 text-courier-500" />,
  },
  {
    title: "Smart Scheduling",
    description: "Automatically coordinate pickup and delivery times between sender and receiver.",
    icon: <CalendarCheck className="h-12 w-12 text-courier-500" />,
  },
];

const Index = () => {
  const { user, isPasswordReset } = useAuth();
  const navigate = useNavigate();
  
  // Check for password reset hash in URL
  useEffect(() => {
    if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='))) {
      console.log("Password reset hash detected on homepage, redirecting to auth page");
      navigate("/auth?action=resetPassword", { replace: true });
      toast.info("Please set your new password");
    }
  }, [navigate]);

  return (
    <Layout>
      {/* Hero Section with stunning gradient background */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-glow/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }}></div>
        </div>
        
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-6 animate-fade-in">
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl text-gradient">
                Book your Bike 
                <br />
                <span className="text-primary">Delivery</span> now!
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Eco-friendly, fast, and reliable courier services for your business needs
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              {user ? (
                <>
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
                </>
              ) : (
                <Link to="/auth">
                  <Button variant="premium" size="lg" className="min-w-[250px]">
                    <LogIn className="mr-2 h-5 w-5" />
                    Sign In / Sign Up
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with beautiful cards */}
      <section className="py-20 relative">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-6">
              Key Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage courier orders with style and efficiency
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="glass hover-lift border-border/50 group animate-slide-up"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <CardContent className="p-8 flex flex-col items-center text-center">
                  <div className="mb-6 p-4 rounded-2xl bg-gradient-primary/10 group-hover:bg-gradient-primary/20 transition-all duration-300">
                    <Package className="h-12 w-12 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <div className="container px-4 md:px-6 relative z-10">
          <div className="text-center space-y-8 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-bold text-gradient">
              Ready to get started?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of businesses already using our eco-friendly delivery service
            </p>
            {!user && (
              <Link to="/auth">
                <Button variant="premium" size="lg" className="min-w-[200px]">
                  Get Started Today
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
