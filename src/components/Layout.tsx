
import React from "react";
import { Link } from "react-router-dom";
import { Truck, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/cycle-courier-logo.png" alt="Cycle Courier Company" className="h-10" />
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link to="/" className="text-gray-600 hover:text-courier-600 transition-colors">
              Home
            </Link>
            {user ? (
              <>
                <Link to="/create-order" className="text-gray-600 hover:text-courier-600 transition-colors">
                  Create Order
                </Link>
                <Link to="/dashboard" className="text-gray-600 hover:text-courier-600 transition-colors">
                  Dashboard
                </Link>
              </>
            ) : (
              <Link to="/auth" className="text-gray-600 hover:text-courier-600 transition-colors">
                Sign In
              </Link>
            )}
          </nav>
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <span className="text-sm">{user.email}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-gray-100 border-t border-gray-200 py-6">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} Cycle Courier Company. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
