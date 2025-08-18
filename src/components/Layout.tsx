import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Truck, LogOut, User, Menu, X, Shield, Home, BarChart3, Info, FileText, Mail, Phone, Facebook, Instagram, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import ThemeToggle from "./ThemeToggle";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut, userProfile } = useAuth();
  const [open, setOpen] = useState(false);

  const closeSheet = () => setOpen(false);

  const isAdmin = userProfile?.role === 'admin';

  const navLinks = (
    <>
      <Link to="/" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
        Home
      </Link>
      <Link to="/tracking" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
        Track Order
      </Link>
      {user ? (
        <Link to="/create-order" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
          Create Order
        </Link>
      ) : (
        <Link to="/auth/login" onClick={closeSheet} className="text-foreground hover:text-courier-500 transition-colors">
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
          
          <nav className="hidden md:flex space-x-6">
            {navLinks}
          </nav>
          
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle />
            
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px]">
                <div className="flex flex-col space-y-4 py-4">
                  {navLinks}
                  
                  {user && (
                    <>
                      <DropdownMenuSeparator className="my-2" />
                      <Link 
                        to="/dashboard" 
                        onClick={closeSheet}
                        className="flex items-center text-foreground hover:text-courier-500 transition-colors"
                      >
                        <Home className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                      {isAdmin && (
                        <Link 
                          to="/analytics" 
                          onClick={closeSheet}
                          className="flex items-center text-foreground hover:text-courier-500 transition-colors"
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analytics
                        </Link>
                      )}
                      <Link 
                        to="/profile" 
                        onClick={closeSheet}
                        className="flex items-center text-foreground hover:text-courier-500 transition-colors"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Your Profile
                      </Link>
                      {isAdmin && (
                        <Link 
                          to="/account-approvals" 
                          onClick={closeSheet}
                          className="flex items-center text-foreground hover:text-courier-500 transition-colors"
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Account Approvals
                        </Link>
                      )}
                      <button 
                        onClick={() => { signOut(); closeSheet(); }} 
                        className="flex items-center text-foreground hover:text-courier-500 transition-colors"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <div className="hidden md:flex items-center space-x-2">
            <ThemeToggle />
            
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer flex w-full items-center">
                      <Home className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/analytics" className="cursor-pointer flex w-full items-center">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Analytics</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer flex w-full items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Your Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/account-approvals" className="cursor-pointer flex w-full items-center">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Account Approvals</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
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
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">The Cycle Courier Co.</h3>
              <p className="text-sm opacity-80">
                Eco-friendly bicycle courier services for businesses and individuals.
              </p>
              <div className="mt-4 space-y-1">
                <p className="text-sm opacity-80">Cycorco Ltd T/A Cycle Courier Co.</p>
                <p className="text-sm opacity-80">Company No: 16220087</p>
                <div className="text-sm opacity-80">
                  <p>Company address:</p>
                  <address className="not-italic">
                    339 Haunch Lane<br />
                    Birmingham<br />
                    B13 0PL
                  </address>
                </div>
              </div>
              <div className="mt-4 flex space-x-4">
                <a 
                  href="https://www.instagram.com/cyclecourierco" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-white/80 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a 
                  href="https://www.facebook.com/people/The-Cycle-Courier-Co/61573561676506" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-white/80 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a 
                  href="https://www.trustpilot.com/review/cyclecourierco.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white hover:text-white/80 transition-colors"
                  aria-label="Trustpilot Reviews"
                >
                  <ExternalLink className="h-5 w-5" />
                  <span className="sr-only">Trustpilot Reviews</span>
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
              <ul className="space-y-2">
                <li>
                  <div className="flex items-start text-sm opacity-80">
                    <span className="mt-1 mr-2"><Mail className="h-4 w-4" /></span>
                    <span>info@cyclecourierco.com</span>
                  </div>
                </li>
                <li>
                  <div className="flex items-start text-sm opacity-80">
                    <span className="mt-1 mr-2"><Phone className="h-4 w-4" /></span>
                    <span>+44 121 798 0767 (Call or WhatsApp)</span>
                  </div>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="text-sm opacity-80 hover:opacity-100 transition-opacity">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-sm opacity-80 hover:opacity-100 transition-opacity">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/tracking" className="text-sm opacity-80 hover:opacity-100 transition-opacity">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link to="/create-order" className="text-sm opacity-80 hover:opacity-100 transition-opacity">
                    Create Order
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/privacy" className="text-sm opacity-80 hover:opacity-100 transition-opacity flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-sm opacity-80 hover:opacity-100 transition-opacity flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    Terms &amp; Conditions
                  </Link>
                </li>
                <li>
                  <Link to="/api-docs" className="text-sm opacity-80 hover:opacity-100 transition-opacity flex items-center">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    API Documentation
                  </Link>
                </li>
                <li>
                  <a 
                    href="https://www.trustpilot.com/review/cyclecourierco.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm opacity-80 hover:opacity-100 transition-opacity flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Trustpilot Reviews
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 mt-6 pt-6 text-center">
            <p>&copy; {new Date().getFullYear()} The Cycle Courier Co. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
