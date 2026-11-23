/**
 * Knowledge Base access for drivers. Mirrors public.kb_viewer_is_driver_only():
 * a "driver-only" user holds the driver role and no office/workshop staff role.
 * Those users read only Published SOPs in the Drivers section and cannot edit.
 * The database enforces the same rule; this only shapes the screen.
 */
export const KB_DRIVERS_CATEGORY_SLUG = "drivers";

const OFFICE_ROLES = [
  "admin",
  "cs_agent",
  "route_planner",
  "loader",
  "sales",
  "timeslip_admin",
  "mechanic",
  "project_manager",
];

export const isKbDriverOnly = (roles: readonly string[]): boolean =>
  roles.includes("driver") && !roles.some((r) => OFFICE_ROLES.includes(r));

export const canDriverSeeArticle = (article: {
  status: string;
  category?: { slug?: string | null } | null;
}): boolean => article.status === "published" && article.category?.slug === KB_DRIVERS_CATEGORY_SLUG;
