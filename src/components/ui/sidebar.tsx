
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  LayoutDashboard, 
  ClipboardList, 
  CalendarClock, 
  UserCircle, 
  Settings, 
  LogOut, 
  Users,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { signOut, userProfile } = useAuth();
  const location = useLocation();
  const isAdmin = userProfile?.role === 'admin';
  
  const links = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard size={20} />,
      adminOnly: false,
    },
    {
      title: "Create Order",
      href: "/create-order",
      icon: <ClipboardList size={20} />,
      adminOnly: false,
    },
    {
      title: "Job Scheduling",
      href: "/job-scheduling",
      icon: <CalendarClock size={20} />,
      adminOnly: true,
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: <BarChart3 size={20} />,
      adminOnly: true,
    },
    {
      title: "Account Approvals",
      href: "/account-approvals",
      icon: <Users size={20} />,
      adminOnly: true,
    },
    {
      title: "Profile",
      href: "/profile",
      icon: <UserCircle size={20} />,
      adminOnly: false,
    },
  ];

  const handleSignOut = () => {
    signOut();
  };

  return (
    <aside className={cn("h-screen bg-card border-r flex flex-col", className)}>
      <div className="flex justify-center my-6">
        <img
          src="/cycle-courier-logo.png"
          alt="The Cycle Courier Co."
          className="h-10"
        />
      </div>

      <div className="flex-1 flex flex-col py-4 px-3 space-y-1">
        {links.map(
          (link) =>
            (!link.adminOnly || isAdmin) && (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-md px-3 py-2 transition-colors",
                    "hover:text-foreground hover:bg-accent",
                    {
                      "bg-accent text-foreground": isActive,
                      "text-muted-foreground": !isActive,
                    }
                  )
                }
              >
                <span className="mr-2">{link.icon}</span>
                <span>{link.title}</span>
              </NavLink>
            )
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <ThemeToggle />
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut size={18} className="mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
