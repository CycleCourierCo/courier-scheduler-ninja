import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img
              src="/cycle-courier-logo.png"
              alt="Cycle Courier Logo"
              className="h-10 w-auto mr-2"
            />
            <h1 className="text-2xl font-bold text-courier-600">Cycle Courier</h1>
          </div>
          <div className="flex space-x-4 items-center">
            <Button variant="ghost" asChild>
              <a href="/tracking">Track Your Order</a>
            </Button>
            {user ? (
              <Button onClick={() => navigate("/dashboard")}>Dashboard</Button>
            ) : (
              <Button onClick={() => navigate("/auth")}>Login</Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-grow">
        <section className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-800 mb-4">
            Efficient Bike Courier Scheduling
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Streamline your bike courier operations with our intuitive scheduling
            platform.
          </p>
          <Button size="lg" onClick={() => navigate(user ? "/create-order" : "/auth")}>
            {user ? "Create Order" : "Get Started"}
          </Button>
        </section>
      </main>

      <footer className="bg-gray-100 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© {new Date().getFullYear()} Cycle Courier. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
