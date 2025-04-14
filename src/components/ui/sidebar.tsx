import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Plus,
  User,
  BarChart3,
  CalendarDays,
  Users,
  ClipboardCheck,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";

export interface SidebarProps {
  className?: string;
  isSidebarOpen: boolean;
  onCloseSidebar?: () => void;
  showAppsList?: boolean;
  sidebarLinks?: {
    href: string;
    icon: React.ReactNode;
    label: string;
  }[];
}

export function Sidebar({
  className,
  isSidebarOpen,
  onCloseSidebar,
  showAppsList = false,
  sidebarLinks,
}: SidebarProps) {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const getDefaultLinks = () => {
    const links = [
      {
        href: "/dashboard",
        icon: <LayoutDashboard className="h-5 w-5" />,
        label: "Dashboard",
      },
      {
        href: "/create-order",
        icon: <Plus className="h-5 w-5" />,
        label: "New Order",
      },
      {
        href: "/jobs",
        icon: <ClipboardCheck className="h-5 w-5" />,
        label: "Jobs",
      },
      {
        href: "/scheduling",
        icon: <CalendarDays className="h-5 w-5" />,
        label: "Scheduling",
      }
    ];
    
    // Only add Analytics link for admin users
    if (isAdmin) {
      links.push({
        href: "/analytics",
        icon: <BarChart3 className="h-5 w-5" />,
        label: "Analytics",
      });
    }
    
    links.push({
      href: "/account-approvals",
      icon: <Users className="h-5 w-5" />,
      label: "Account Approvals",
    });
    
    links.push({
      href: "/profile",
      icon: <User className="h-5 w-5" />,
      label: "Profile",
    });
    
    return links;
  };

  const links = sidebarLinks || getDefaultLinks();

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={onCloseSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 bottom-0 z-50 flex h-screen border-r bg-background transition-all duration-300",
          isSidebarOpen
            ? "left-0 w-64 translate-x-0"
            : isMobile
            ? "-translate-x-full w-64"
            : "w-16",
          className
        )}
      >
        <div className="flex flex-1 flex-col overflow-y-auto pb-4 pt-5">
          <div className="flex justify-center">
            <Link to="/" onClick={isMobile ? onCloseSidebar : undefined}>
              <div className="flex items-center justify-center">
                <img
                  src="/cycle-courier-logo.png"
                  alt="Logo"
                  height={32}
                  width={32}
                  className="h-8 w-8"
                />
                {isSidebarOpen && (
                  <span className="ml-3 text-lg font-bold">Cycle Courier</span>
                )}
              </div>
            </Link>
          </div>

          <div className="mt-8 flex-1">
            <nav className="space-y-2 px-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={isMobile ? onCloseSidebar : undefined}
                  className={cn(
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-courier-500 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                >
                  {link.icon}
                  {isSidebarOpen && <span className="ml-3">{link.label}</span>}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
