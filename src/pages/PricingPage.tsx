import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Bike, MapPin, Wrench, CalendarCheck, Info } from "lucide-react";

const pricingData = [
  { type: "Boxed Kids Bikes", price: 35 },
  { type: "Wheelset/Frameset", price: 35 },
  { type: "Kids Bikes", price: 40 },
  { type: "BMX Bikes", price: 40 },
  { type: "Bike Rack", price: 40 },
  { type: "Turbo Trainer", price: 40 },
  { type: "Folding Bikes", price: 40 },
  { type: "Non-Electric Bikes", price: 60 },
  { type: "Travel Bike Boxes", price: 60 },
  { type: "Electric Bikes under 25kg", price: 70 },
  { type: "Electric Bikes over 25kg", price: 130 },
  { type: "Longtail Cargo Bikes", price: 130 },
  { type: "Stationary Bikes", price: 70 },
  { type: "Tandem Bikes", price: 110 },
  { type: "Recumbent", price: 130 },
  { type: "Small Trike", price: 150 },
  { type: "Large Trike", price: 180 },
  { type: "Double Seat/Platform/Cargo Trikes", price: 225 },
];

const PricingPage: React.FC = () => {
  const { userProfile } = useAuth();

  const isB2B = userProfile?.role === "b2b_customer";
  const isAdmin = userProfile?.role === "admin";

  if (!isB2B && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Delivery Pricing
          </h1>
          <p className="text-lg text-muted-foreground mb-3">
            Collection in Mainland England &amp; Wales
          </p>
          <Badge variant="secondary" className="text-sm px-4 py-1">
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            Fully Insured
          </Badge>
        </div>

        {/* Standard Delivery Prices */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Bike className="mr-2 h-5 w-5 text-primary" />
              Standard Delivery Prices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-0 divide-y divide-border">
              {pricingData.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-foreground">{item.type}</span>
                  <span className="font-semibold text-foreground whitespace-nowrap ml-4">
                    £{item.price}{" "}
                    <span className="text-muted-foreground font-normal text-sm">
                      + VAT
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scotland */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <MapPin className="mr-2 h-5 w-5 text-primary" />
              Scotland
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground italic">Prices coming soon!</p>
          </CardContent>
        </Card>

        {/* Additional Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Wrench className="mr-2 h-5 w-5 text-primary" />
              Additional Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-0 divide-y divide-border">
              <div className="flex items-center justify-between py-3 first:pt-0">
                <span className="text-foreground">
                  Inspect, clean &amp; service
                </span>
                <span className="font-semibold text-foreground whitespace-nowrap ml-4">
                  £60{" "}
                  <span className="text-muted-foreground font-normal text-sm">
                    + VAT
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center">
                  <CalendarCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    Exact date deliveries
                  </span>
                </div>
                <Badge variant="outline" className="ml-4">
                  Price on request
                </Badge>
              </div>
              <div className="flex items-center justify-between py-3 last:pb-0">
                <div className="flex items-center">
                  <Info className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    Channel Islands &amp; Scotland deliveries
                  </span>
                </div>
                <Badge variant="outline" className="ml-4">
                  Price on request
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PricingPage;
