import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Truck, LogOut, User, Menu, X, Shield, Home, BarChart3, FileText, Mail, Phone, Facebook, Instagram, ExternalLink, Key, Package, Package2, Calendar, CalendarOff, Users, Clock, TrendingUp, Webhook, Wrench, PoundSterling, Megaphone, Upload, Warehouse, Fuel, Car, ShieldAlert, Inbox, CheckSquare, BookOpen, Store, ClipboardCheck, Lock, Boxes, KanbanSquare, Plug } from "lucide-react";
import NoticeBanner from "./NoticeBanner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import ThemeToggle from "./ThemeToggle";
import TaskNotificationBell from "./tasks/TaskNotificationBell";
import BrandLogo from "./BrandLogo";
import { hasRole, getRoles } from "@/lib/roles";
import { useRoutePermissions } from "@/hooks/useRoutePermissions";
interface LayoutProps {
  children: React.ReactNode;
}

type AdminMenuItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type AdminMenuSection = { label: string; items: AdminMenuItem[] };

/**
 * Single source of truth for the admin menu, rendered in both the desktop
 * dropdown and the mobile sheet so the two can't drift apart.
 */
const ADMIN_MENU_SECTIONS: AdminMenuSection[] = [
  {
    label: "Orders",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: Home },
      { to: "/create-order", label: "Create Order", icon: Package },
      { to: "/bulk-upload", label: "Bulk Upload", icon: Upload },
      { to: "/tracking", label: "Track Order", icon: Truck },
      { to: "/invoices", label: "Invoices", icon: FileText },
      { to: "/pricing", label: "Pricing", icon: PoundSterling },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/project-management", label: "Project Management", icon: KanbanSquare },
      { to: "/scheduling", label: "Job Scheduling", icon: Calendar },
      { to: "/loading", label: "Loading & Storage", icon: Package },
      { to: "/warehouse-stock", label: "Warehouse Stock", icon: Warehouse },
      { to: "/storage-bays", label: "Storage Bays", icon: Warehouse },
      { to: "/trunk-runs", label: "Trunk Runs", icon: Truck },
      { to: "/bulk-availability", label: "Bulk Availability", icon: Clock },
      { to: "/my-stock", label: "My Stock", icon: Warehouse },
    ],
  },
  {
    label: "Workshop",
    items: [
      { to: "/bicycle-inspections", label: "Bicycle Inspections", icon: Wrench },
      { to: "/admin/labour-times", label: "Labour Times", icon: Wrench },
      { to: "/mechanic-clock", label: "Mechanic Clock", icon: Clock },
      { to: "/box-my-bike", label: "Box My Bike", icon: Package2 },
      { to: "/build-my-bike", label: "Build My Bike", icon: Wrench },
    ],
  },
  {
    label: "Fleet",
    items: [
      { to: "/equipment", label: "Equipment", icon: Boxes },
      { to: "/vehicles", label: "Vehicles", icon: Car },
      { to: "/driver-timeslips", label: "Driver Timeslips", icon: Clock },
      { to: "/fuel-finder", label: "Fuel Finder", icon: Fuel },
      { to: "/claims", label: "Damage Claims", icon: ShieldAlert },
    ],
  },
  {
    label: "Insight",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/route-profitability", label: "Route Profitability", icon: TrendingUp },
      { to: "/mechanic-profitability", label: "Mechanic Profitability", icon: Wrench },
    ],
  },
  {
    label: "Comms",
    items: [
      { to: "/inbox", label: "Customer Service Inbox", icon: Inbox },
      { to: "/tasks", label: "Tasks", icon: CheckSquare },
      { to: "/notices", label: "Notice Bars", icon: Megaphone },
      { to: "/emails", label: "Announcement Emails", icon: Mail },
      { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/profile", label: "Your Profile", icon: User },
      { to: "/reviews", label: "Employee Reviews", icon: ClipboardCheck },
      { to: "/my-reviews", label: "My Reviews", icon: ClipboardCheck },
      { to: "/users", label: "User Management", icon: Users },
      { to: "/account-approvals", label: "Account Approvals", icon: Shield },
      { to: "/holidays", label: "Holidays", icon: CalendarOff },
      { to: "/api-keys", label: "API Keys", icon: Key },
      { to: "/admin/partner-apps", label: "Partner Apps", icon: Plug },
      { to: "/webhooks", label: "Webhooks", icon: Webhook },
      { to: "/shopify-integration", label: "Shopify Integration", icon: Store },
      { to: "/admin/route-permissions", label: "Route Permissions", icon: Lock },
      { to: "/api-docs", label: "API Documentation", icon: FileText },
    ],
  },
];
// Groups menu items without a bare Fragment, so dev tooling attributes don't
// trigger React's invalid-Fragment-prop warning on every sidebar render.
const MenuGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const Layout: React.FC<LayoutProps> = ({
  children
}) => {
  const {
    user,
    signOut,
    userProfile
  } = useAuth();
  const [open, setOpen] = useState(false);
  const closeSheet = () => setOpen(false);
  const isAdmin = hasRole(userProfile, 'admin');
  const isLoader = hasRole(userProfile, 'loader');
  const isRoutePlanner = hasRole(userProfile, 'route_planner');
  const isSales = hasRole(userProfile, 'sales');
  const isB2B = hasRole(userProfile, 'b2b_customer');
  const isDriver = hasRole(userProfile, 'driver');
  const isMechanic = hasRole(userProfile, 'mechanic');
  const isB2C = hasRole(userProfile, 'b2c_customer');
  const isTimeslipAdmin = hasRole(userProfile, 'timeslip_admin');
  const isCsAgent = hasRole(userProfile, 'cs_agent');
  const { isAllowedKey, allowedPages } = useRoutePermissions(getRoles(userProfile));
  const isProjectManager = hasRole(userProfile, 'project_manager');
  const isInternalStaff = isAdmin || isLoader || isRoutePlanner || isSales || isDriver || isMechanic || isTimeslipAdmin || isCsAgent || isProjectManager;


  // Only suppress general nav for users whose ONLY responsibilities are loader/mechanic/timeslip_admin/cs_agent
  const onlyLoaderOrMechanic =
    (isLoader || isMechanic || isTimeslipAdmin || isCsAgent) &&
    !isAdmin && !isRoutePlanner && !isSales && !isB2B && !isDriver && !isB2C;

  const navLinks = !onlyLoaderOrMechanic && !user ? <>
      <Link to="/tracking" onClick={closeSheet} className="text-foreground hover:text-primary transition-colors">
        Track Order
      </Link>
      <Link to="/auth/login" onClick={closeSheet} className="text-foreground hover:text-primary transition-colors">
        Sign In
      </Link>
    </> : null;

  // Pages this (non-admin) user is permitted to see, from the role/route matrix
  const permittedPages = allowedPages.filter(
    p => !['profile'].includes(p.key)
  );


  const staffNavLinks = user && !isAdmin ? <>
      {permittedPages.slice(0, 6).map(page => (
        <Link key={page.key} to={page.path} onClick={closeSheet} className="text-foreground hover:text-primary transition-colors">
          {page.label}
        </Link>
      ))}
    </> : null;

  const staffMenuLinks = user && !isAdmin ? <>
      {permittedPages.map(page => (
        <Link key={page.key} to={page.path} onClick={closeSheet} className="flex items-center text-foreground hover:text-primary transition-colors">
          <page.icon className="mr-2 h-4 w-4" />
          {page.label}
        </Link>
      ))}
    </> : null;


  return <div className="min-h-screen flex flex-col">
      <NoticeBanner />
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container mx-auto flex min-h-16 items-center justify-between px-4 py-2">
          <Link to="/" className="min-w-0" aria-label="Cycle Courier Co. home">
            <BrandLogo compact showMobileWordmark className="md:hidden" />
            <BrandLogo className="hidden h-10 w-52 md:block" />
          </Link>
          
          <nav className="hidden items-center gap-5 text-sm font-semibold md:flex">
            {navLinks}
            {staffNavLinks}

          </nav>
          
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle />
            {user && isInternalStaff && <TaskNotificationBell />}
            
            
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px] overflow-hidden border-l bg-card">
                <div className="flex flex-col space-y-4 py-4 h-full overflow-y-auto">
                  {navLinks}
                  {staffMenuLinks}
                              
                  
                  {user && <>
                      <DropdownMenuSeparator className="my-2" />
                      {!isAdmin && <Link to="/profile" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                        <User className="mr-2 h-4 w-4" />
                        Your Profile
                      </Link>}

                      {isAdmin && <>
                          {ADMIN_MENU_SECTIONS.map(section => <div key={section.label} className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                              {section.label}
                            </p>
                            {section.items.map(item => <Link key={item.to} to={item.to} onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                              <item.icon className="mr-2 h-4 w-4" />
                              {item.label}
                            </Link>)}
                          </div>)}
                        </>}
                      {isB2B && (
                        <>
                          <Link to="/my-stock" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <Warehouse className="mr-2 h-4 w-4" />
                            My Stock
                          </Link>
                          <Link to="/pricing" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <PoundSterling className="mr-2 h-4 w-4" />
                            Pricing
                          </Link>
                          <Link to="/bulk-availability" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <Clock className="mr-2 h-4 w-4" />
                            Bulk Availability
                          </Link>
                          <Link to="/bicycle-inspections" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <Wrench className="mr-2 h-4 w-4" />
                            My Inspections
                          </Link>
                        </>
                      )}
                      {isRoutePlanner && !isAdmin && <>
                        <Link to="/scheduling" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                          <Calendar className="mr-2 h-4 w-4" />
                          Job Scheduling
                        </Link>
                      </>}
                      {isSales && !isAdmin && <>
                          <Link to="/account-approvals" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <Shield className="mr-2 h-4 w-4" />
                            Account Approvals
                          </Link>
                          <Link to="/invoices" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <FileText className="mr-2 h-4 w-4" />
                            Invoices
                          </Link>
                        </>}
                      {isDriver && <>
                          <Link to="/driver-timeslips" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <Clock className="mr-2 h-4 w-4" />
                            My Timeslips
                          </Link>
                          <Link to="/fuel-finder" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                            <Fuel className="mr-2 h-4 w-4" />
                            Fuel Finder
                          </Link>
                        </>}
                      {isMechanic && !isAdmin && !isB2B && <Link to="/bicycle-inspections" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                          <Wrench className="mr-2 h-4 w-4" />
                          Bicycle Inspections
                        </Link>}
                      {isTimeslipAdmin && !isAdmin && <Link to="/driver-timeslips" onClick={closeSheet} className="flex items-center text-foreground hover:text-courier-500 transition-colors">
                          <Clock className="mr-2 h-4 w-4" />
                          Driver Timeslips
                        </Link>}
                      <Button variant="ghost" onClick={() => {
                        signOut();
                        closeSheet();
                      }} className="flex w-full items-center justify-start px-0 text-foreground hover:text-primary">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </>}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
          <div className="hidden md:flex items-center space-x-2">
            <ThemeToggle />
            {user && isInternalStaff && <TaskNotificationBell />}
            
            
            {user && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[calc(100vh-100px)] overflow-y-auto">
                  <DropdownMenuItem disabled>
                    <span className="text-sm">{user.email}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  
                  {!isAdmin && <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer flex w-full items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Your Profile</span>
                    </Link>
                  </DropdownMenuItem>}

                  {!isAdmin && permittedPages.map(page => (
                    <DropdownMenuItem key={page.key} asChild>
                      <Link to={page.path} className="cursor-pointer flex w-full items-center">
                        <page.icon className="mr-2 h-4 w-4" />
                        <span>{page.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}

                  {isAdmin && <>
                      {ADMIN_MENU_SECTIONS.map(section => <MenuGroup key={section.label}>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                          {section.label}
                        </DropdownMenuLabel>
                        {section.items.map(item => <DropdownMenuItem key={item.to} asChild>
                          <Link to={item.to} className="cursor-pointer flex w-full items-center">
                            <item.icon className="mr-2 h-4 w-4" />
                            <span>{item.label}</span>
                          </Link>
                        </DropdownMenuItem>)}
                      </MenuGroup>)}
                    </>}
                  
                  {isB2B && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/my-stock" className="cursor-pointer flex w-full items-center">
                          <Warehouse className="mr-2 h-4 w-4" />
                          <span>My Stock</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/pricing" className="cursor-pointer flex w-full items-center">
                          <PoundSterling className="mr-2 h-4 w-4" />
                          <span>Pricing</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/bulk-availability" className="cursor-pointer flex w-full items-center">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>Bulk Availability</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/bicycle-inspections" className="cursor-pointer flex w-full items-center">
                          <Wrench className="mr-2 h-4 w-4" />
                          <span>My Inspections</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {isRoutePlanner && <>
                    <DropdownMenuItem asChild>
                      <Link to="/scheduling" className="cursor-pointer flex w-full items-center">
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Job Scheduling</span>
                      </Link>
                    </DropdownMenuItem>
                  </>}
                  
                  {isDriver && <>
                    <DropdownMenuItem asChild>
                      <Link to="/driver-timeslips" className="cursor-pointer flex w-full items-center">
                        <Clock className="mr-2 h-4 w-4" />
                        <span>My Timeslips</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/fuel-finder" className="cursor-pointer flex w-full items-center">
                        <Fuel className="mr-2 h-4 w-4" />
                        <span>Fuel Finder</span>
                      </Link>
                    </DropdownMenuItem>
                  </>}
                  
                  {isSales && <>
                      <DropdownMenuItem asChild>
                        <Link to="/account-approvals" className="cursor-pointer flex w-full items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Account Approvals</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/invoices" className="cursor-pointer flex w-full items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Invoices</span>
                        </Link>
                      </DropdownMenuItem>
                    </>}
                  
                  {isMechanic && <DropdownMenuItem asChild>
                      <Link to="/bicycle-inspections" className="cursor-pointer flex w-full items-center">
                        <Wrench className="mr-2 h-4 w-4" />
                        <span>Bicycle Inspections</span>
                      </Link>
                    </DropdownMenuItem>}

                  {isMechanic && !isAdmin && <DropdownMenuItem asChild>
                      <Link to="/admin/labour-times" className="cursor-pointer flex w-full items-center">
                        <Wrench className="mr-2 h-4 w-4" />
                        <span>Labour Times</span>
                      </Link>
                    </DropdownMenuItem>}

                  {isTimeslipAdmin && !isAdmin && <DropdownMenuItem asChild>
                      <Link to="/driver-timeslips" className="cursor-pointer flex w-full items-center">
                        <Clock className="mr-2 h-4 w-4" />
                        <span>Driver Timeslips</span>
                      </Link>
                    </DropdownMenuItem>}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t bg-background py-10 text-muted-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="space-y-4">
              <BrandLogo className="mb-4 h-12 w-60 max-w-full" />
              
              <div className="mt-6 space-y-2">
                <p className="text-sm opacity-90">Cycorco Ltd T/A Cycle Courier Co.</p>
                <p className="text-sm opacity-90">Company No: 16220087</p>
                <p className="text-sm opacity-90">VAT Number: GB507727188</p>
                <div className="text-sm opacity-90">
                  <p className="font-medium">Company address:</p>
                  <address className="not-italic opacity-80">
                    30 Wake Green Road<br />
                    Birmingham<br />
                    B13 9PB
                  </address>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="mb-4 text-base font-bold text-foreground">Contact</h3>
              <ul className="space-y-2">
                <li>
                  <div className="flex items-start text-sm opacity-90 hover:opacity-100 transition-opacity">
                    <span className="mt-1 mr-3 rounded-md border p-2"><Mail className="h-4 w-4" /></span>
                    <span>info@cyclecourierco.com</span>
                  </div>
                </li>
                <li>
                  <div className="flex items-start text-sm opacity-90 hover:opacity-100 transition-opacity">
                    <span className="mt-1 mr-3 rounded-md border p-2"><Phone className="h-4 w-4" /></span>
                    <span>+44 121 798 0767 (Call or WhatsApp)</span>
                  </div>
                </li>
              </ul>
              <div className="mt-6 flex space-x-4">
                <a href="https://www.instagram.com/cyclecourierco" target="_blank" rel="noopener noreferrer" className="rounded-md border p-3 hover:bg-accent" aria-label="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="https://www.facebook.com/people/The-Cycle-Courier-Co/61573561676506" target="_blank" rel="noopener noreferrer" className="rounded-md border p-3 hover:bg-accent" aria-label="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="https://www.trustpilot.com/review/cyclecourierco.com" target="_blank" rel="noopener noreferrer" className="rounded-md border p-3 hover:bg-accent" aria-label="Trustpilot Reviews">
                  <ExternalLink className="h-5 w-5" />
                  <span className="sr-only">Trustpilot Reviews</span>
                </a>
              </div>
            </div>
            
            <div>
              <h3 className="mb-4 text-base font-bold text-foreground">Quick links</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="text-sm opacity-90 hover:opacity-100 hover:text-primary-foreground hover:translate-x-1 transition-all duration-300">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-sm opacity-90 hover:opacity-100 hover:text-primary-foreground hover:translate-x-1 transition-all duration-300">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/tracking" className="text-sm opacity-90 hover:opacity-100 hover:text-primary-foreground hover:translate-x-1 transition-all duration-300">
                    Track Order
                  </Link>
                </li>
                <li>
                  <Link to="/create-order" className="text-sm opacity-90 hover:opacity-100 hover:text-primary-foreground hover:translate-x-1 transition-all duration-300">
                    Create Order
                  </Link>
                </li>
                {isB2B && (
                  <li>
                    <Link to="/pricing" className="text-sm opacity-90 hover:opacity-100 hover:text-primary-foreground hover:translate-x-1 transition-all duration-300">
                      Pricing
                    </Link>
                  </li>
                )}
              </ul>
            </div>
            
            <div className="md:col-start-3">
              <h3 className="mb-4 text-base font-bold text-foreground">Legal</h3>
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
                  <a href="https://www.trustpilot.com/review/cyclecourierco.com" target="_blank" rel="noopener noreferrer" className="text-sm opacity-80 hover:opacity-100 transition-opacity flex items-center">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Trustpilot Reviews
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t pt-6 text-center">
            <p className="text-sm opacity-90">&copy; {new Date().getFullYear()} The Cycle Courier Co. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Layout;