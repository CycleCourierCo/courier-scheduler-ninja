
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/Layout";
import { Truck, Package, CalendarCheck, ChevronRight } from "lucide-react";

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
  {
    title: "Shipday Integration",
    description: "Seamlessly create shipping orders with Shipday's powerful API.",
    icon: <Truck className="h-12 w-12 text-courier-500" />,
  },
];

const Index = () => {
  return (
    <Layout>
      <section className="py-12 md:py-24">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none text-courier-800">
                Courier Management Made Simple
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl">
                Streamline your courier operations with our powerful job management platform.
              </p>
            </div>
            <div className="space-x-4">
              <Link to="/create-order">
                <Button className="bg-courier-600 hover:bg-courier-700">Create Order</Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="outline">View Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-50">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-courier-800">How It Works</h2>
            <p className="mt-4 text-lg text-gray-600">Our simple three-step process</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-courier-100 p-4 mb-4">
                <span className="text-2xl font-bold text-courier-600">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Create an Order</h3>
              <p className="text-gray-600">Enter sender and receiver information to create a new shipping order.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-courier-100 p-4 mb-4">
                <span className="text-2xl font-bold text-courier-600">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Schedule Pickup & Delivery</h3>
              <p className="text-gray-600">Automatically coordinate available dates between sender and receiver.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-courier-100 p-4 mb-4">
                <span className="text-2xl font-bold text-courier-600">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Ship with Confidence</h3>
              <p className="text-gray-600">Automatically create Shipday orders and track shipments in real-time.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-courier-800">Key Features</h2>
            <p className="mt-4 text-lg text-gray-600">Everything you need to manage courier orders</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

      <section className="py-12 bg-courier-600 text-white">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Ready to get started?</h2>
              <p className="mx-auto max-w-[600px] text-courier-100">
                Start managing your courier orders more efficiently today.
              </p>
            </div>
            <Link to="/create-order">
              <Button className="bg-white text-courier-800 hover:bg-gray-100">
                Create Your First Order
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
