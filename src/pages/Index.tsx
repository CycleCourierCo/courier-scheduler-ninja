
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/Layout";
import { Package, CalendarCheck, ChevronRight, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();

  return (
    <Layout>
      <section className="py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none text-courier-500">
                Book your Bike Delivery now!
              </h1>
            </div>
            <div className="space-x-4">
              {user ? (
                <>
                  <Link to="/create-order">
                    <Button className="bg-courier-500 hover:bg-courier-600">Create Order</Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button variant="outline" className="border-courier-500 text-courier-500">View Dashboard</Button>
                  </Link>
                </>
              ) : (
                <Link to="/auth">
                  <Button className="bg-courier-500 hover:bg-courier-600">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In / Sign Up
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-courier-500">Key Features</h2>
            <p className="mt-4 text-lg text-gray-600">Everything you need to manage courier orders</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-gray-200">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
