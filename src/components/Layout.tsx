
import React from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Truck size={24} className="text-courier-600" />
            <span className="font-bold text-xl text-courier-800">CourierNinja</span>
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link to="/" className="text-gray-600 hover:text-courier-600 transition-colors">
              Home
            </Link>
            <Link to="/create-order" className="text-gray-600 hover:text-courier-600 transition-colors">
              Create Order
            </Link>
            <Link to="/dashboard" className="text-gray-600 hover:text-courier-600 transition-colors">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-gray-100 border-t border-gray-200 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} CourierNinja. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
