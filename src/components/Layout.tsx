
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Truck, LogOut, User, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import ThemeToggle from "./ThemeToggle";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const closeSheet = () => setOpen(false);

  const navLinks = (
    <>
      <Link to="/" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
        Home
      </Link>
      <Link to="/tracking" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
        Track Order
      </Link>
      {user ? (
        <>
          <Link to="/create-order" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
            Create Order
          </Link>
          <Link to="/dashboard" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
            Dashboard
          </Link>
        </>
      ) : (
        <Link to="/auth" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
          Sign In
        </Link>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-accent">
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <img src="https://cyclecourierco.com/cdn/shop/files/ERY.png?v=1740100482&width=240" alt="The Cycle Courier Co." className="h-12" />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {navLinks}
          </nav>
          
          {/* Mobile Navigation */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px]">
              <div className="flex flex-col space-y-4 py-4">
                {navLinks}
                {user && (
                  <button 
                    onClick={() => { signOut(); closeSheet(); }} 
                    className="flex items-center text-foreground hover:text-courier-500 transition-colors"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </button>
                )}
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild className="hidden md:inline-flex">
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
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-courier-500 text-white py-6">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} The Cycle Courier Co. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
