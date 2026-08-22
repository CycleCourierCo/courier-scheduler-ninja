import type { ComponentType } from "react";
import type { UserRole } from "@/types/user";
import {
  Home, Package, Package2, Upload, Truck, FileText, PoundSterling, Calendar, Sparkles,
  ClipboardList, Route as RouteIcon, Warehouse, Clock, Wrench, Car, Fuel, ShieldAlert,
  BarChart3, TrendingUp, Inbox, CheckSquare, Megaphone, Mail, BookOpen, User, Users,
  Shield, CalendarOff, Key, Webhook, Store, Lock,
} from "lucide-react";

export type AppRouteSection =
  | "Orders" | "Operations" | "Workshop" | "Fleet" | "Insight" | "Comms" | "Admin";

export interface AppRoute {
  /** Stable key stored in role_route_permissions.route_key */
  key: string;
  /** Primary path used for navigation links */
  path: string;
  label: string;
  section: AppRouteSection;
  icon: ComponentType<{ className?: string }>;
  /** Extra path prefixes covered by this key (detail pages, sub-routes) */
  prefixes?: string[];
  /** Default roles allowed (admin always allowed, never listed) */
  defaultRoles: UserRole[];
  /** Hidden from role menus (still permission-checked) */
  hiddenInMenu?: boolean;
}

const CUSTOMERS: UserRole[] = ["b2b_customer"];

export const APP_ROUTES: AppRoute[] = [
  // Orders
  { key: "dashboard", path: "/dashboard", label: "Dashboard", section: "Orders", icon: Home,
    defaultRoles: [...CUSTOMERS, "route_planner", "sales", "cs_agent"] },
  { key: "create-order", path: "/create-order", label: "Create Order", section: "Orders", icon: Package,
    defaultRoles: [...CUSTOMERS] },
  { key: "bulk-upload", path: "/bulk-upload", label: "Bulk Upload", section: "Orders", icon: Upload,
    defaultRoles: [...CUSTOMERS] },
  { key: "order-detail", path: "/orders", label: "Order Details", section: "Orders", icon: FileText,
    prefixes: ["/orders/"], hiddenInMenu: true,
    defaultRoles: ["route_planner", "cs_agent"] },
  { key: "customer-order-detail", path: "/customer-orders", label: "Customer Order Details", section: "Orders", icon: FileText,
    prefixes: ["/customer-orders/"], hiddenInMenu: true,
    defaultRoles: [...CUSTOMERS, "route_planner", "cs_agent"] },
  { key: "invoices", path: "/invoices", label: "Invoices", section: "Orders", icon: FileText,
    defaultRoles: [] },
  { key: "pricing", path: "/pricing", label: "Pricing", section: "Orders", icon: PoundSterling,
    defaultRoles: [...CUSTOMERS] },

  // Operations
  { key: "scheduling", path: "/scheduling", label: "Job Scheduling", section: "Operations", icon: Calendar,
    defaultRoles: ["route_planner"] },
  { key: "ai-routing", path: "/ai-routing", label: "AI Routing", section: "Operations", icon: Sparkles,
    defaultRoles: ["route_planner"] },
  { key: "dispatch-orders", path: "/dispatch/orders", label: "Dispatch Orders", section: "Operations", icon: ClipboardList,
    defaultRoles: [] },
  { key: "dispatch-routes", path: "/dispatch/routes", label: "Dispatch Routes", section: "Operations", icon: RouteIcon,
    defaultRoles: [] },
  { key: "loading", path: "/loading", label: "Loading & Storage", section: "Operations", icon: Package,
    defaultRoles: ["loader"] },
  { key: "warehouse-stock", path: "/warehouse-stock", label: "Warehouse Stock", section: "Operations", icon: Warehouse,
    defaultRoles: [] },
  { key: "storage-bays", path: "/storage-bays", label: "Storage Bays", section: "Operations", icon: Warehouse,
    defaultRoles: [] },
  { key: "trunk-runs", path: "/trunk-runs", label: "Trunk Runs", section: "Operations", icon: Truck,
    defaultRoles: ["route_planner"] },
  { key: "bulk-availability", path: "/bulk-availability", label: "Bulk Availability", section: "Operations", icon: Clock,
    defaultRoles: [...CUSTOMERS] },
  { key: "my-stock", path: "/my-stock", label: "My Stock", section: "Operations", icon: Warehouse,
    defaultRoles: [...CUSTOMERS] },

  // Workshop
  { key: "bicycle-inspections", path: "/bicycle-inspections", label: "Bicycle Inspections", section: "Workshop", icon: Wrench,
    defaultRoles: ["mechanic", ...CUSTOMERS] },
  { key: "labour-times", path: "/admin/labour-times", label: "Labour Times", section: "Workshop", icon: Wrench,
    defaultRoles: ["mechanic"] },
  { key: "mechanic-clock", path: "/mechanic-clock", label: "Mechanic Clock", section: "Workshop", icon: Clock,
    defaultRoles: ["mechanic"] },
  { key: "box-my-bike", path: "/box-my-bike", label: "Box My Bike", section: "Workshop", icon: Package2,
    defaultRoles: ["mechanic", "loader", ...CUSTOMERS] },

  // Fleet
  { key: "vehicles", path: "/vehicles", label: "Vehicles", section: "Fleet", icon: Car,
    defaultRoles: ["fleet_manager"] },
  { key: "driver-timeslips", path: "/driver-timeslips", label: "Driver Timeslips", section: "Fleet", icon: Clock,
    defaultRoles: ["driver", "timeslip_admin"] },
  { key: "fuel-finder", path: "/fuel-finder", label: "Fuel Finder", section: "Fleet", icon: Fuel,
    defaultRoles: ["driver"] },
  { key: "claims", path: "/claims", label: "Damage Claims", section: "Fleet", icon: ShieldAlert,
    prefixes: ["/claims/"], defaultRoles: ["cs_agent"] },

  // Insight
  { key: "analytics", path: "/analytics", label: "Analytics", section: "Insight", icon: BarChart3,
    defaultRoles: [] },
  { key: "route-profitability", path: "/route-profitability", label: "Route Profitability", section: "Insight", icon: TrendingUp,
    defaultRoles: [] },
  { key: "mechanic-profitability", path: "/mechanic-profitability", label: "Mechanic Profitability", section: "Insight", icon: Wrench,
    defaultRoles: [] },

  // Comms
  { key: "inbox", path: "/inbox", label: "Customer Service Inbox", section: "Comms", icon: Inbox,
    prefixes: ["/inbox/"], defaultRoles: ["cs_agent"] },
  { key: "tasks", path: "/tasks", label: "Tasks", section: "Comms", icon: CheckSquare,
    prefixes: ["/tasks/"],
    defaultRoles: ["route_planner", "sales", "loader", "mechanic", "driver", "timeslip_admin", "cs_agent", "fleet_manager", "tech"] },
  { key: "notices", path: "/notices", label: "Notice Bars", section: "Comms", icon: Megaphone,
    defaultRoles: ["sales"] },
  { key: "emails", path: "/emails", label: "Announcement Emails", section: "Comms", icon: Mail,
    defaultRoles: ["sales"] },
  { key: "knowledge", path: "/knowledge", label: "Knowledge Base", section: "Comms", icon: BookOpen,
    prefixes: ["/knowledge/"],
    defaultRoles: ["route_planner", "sales", "loader", "mechanic", "driver", "timeslip_admin", "cs_agent", "fleet_manager", "tech"] },

  // Admin
  { key: "profile", path: "/profile", label: "Your Profile", section: "Admin", icon: User,
    defaultRoles: ["route_planner", "sales", "loader", "mechanic", "driver", "timeslip_admin", "cs_agent", "fleet_manager", "tech", ...CUSTOMERS] },
  { key: "reviews", path: "/reviews", label: "Employee Reviews", section: "Admin", icon: ClipboardCheck,
    prefixes: ["/reviews/"], defaultRoles: [] },
  { key: "my-reviews", path: "/my-reviews", label: "My Reviews", section: "Admin", icon: ClipboardCheck,
    defaultRoles: ["route_planner", "sales", "loader", "mechanic", "driver", "timeslip_admin", "cs_agent", "fleet_manager", "tech"] },
  { key: "users", path: "/users", label: "User Management", section: "Admin", icon: Users,
    defaultRoles: [] },
  { key: "account-approvals", path: "/account-approvals", label: "Account Approvals", section: "Admin", icon: Shield,
    defaultRoles: [] },
  { key: "holidays", path: "/holidays", label: "Holidays", section: "Admin", icon: CalendarOff,
    defaultRoles: [] },
  { key: "api-keys", path: "/api-keys", label: "API Keys", section: "Admin", icon: Key,
    defaultRoles: ["tech"] },
  { key: "webhooks", path: "/webhooks", label: "Webhooks", section: "Admin", icon: Webhook,
    defaultRoles: ["tech"] },
  { key: "shopify-integration", path: "/shopify-integration", label: "Shopify Integration", section: "Admin", icon: Store,
    defaultRoles: ["tech"] },
  { key: "route-permissions", path: "/admin/route-permissions", label: "Route Permissions", section: "Admin", icon: Lock,
    defaultRoles: [] },
];

export const ROUTE_SECTIONS: AppRouteSection[] =
  ["Orders", "Operations", "Workshop", "Fleet", "Insight", "Comms", "Admin"];

/** Roles that can be granted page access (admin excluded — always full access) */
export const ASSIGNABLE_PERMISSION_ROLES: UserRole[] = [
  "route_planner", "sales", "loader", "mechanic", "driver",
  "timeslip_admin", "cs_agent", "fleet_manager", "tech", "b2b_customer",
];

/** Resolve a pathname to a route definition */
export const findRouteForPath = (pathname: string): AppRoute | undefined => {
  const exact = APP_ROUTES.find(r => r.path === pathname);
  if (exact) return exact;
  return APP_ROUTES.find(r => (r.prefixes ?? []).some(p => pathname.startsWith(p)));
};

export const DEFAULT_PERMISSION_MATRIX = (): Record<string, string[]> => {
  const matrix: Record<string, string[]> = {};
  for (const route of APP_ROUTES) matrix[route.key] = [...route.defaultRoles];
  return matrix;
};
