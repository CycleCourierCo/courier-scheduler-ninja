export const TASK_CATEGORIES = [
  { value: "boxing", label: "Bike boxing" },
  { value: "foaming", label: "Foaming" },
  { value: "inspection", label: "Inspection / servicing" },
  { value: "build", label: "Bike builds" },
  { value: "reviews", label: "Review collecting" },
  { value: "transport", label: "Transport / collections" },
  { value: "northern_ireland", label: "Northern Ireland" },
  { value: "warehouse", label: "Warehouse / storage" },
  { value: "fleet", label: "Fleet / vehicles" },
  { value: "admin", label: "Admin / other" },
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number]["value"];

export const categoryLabel = (value?: string | null): string =>
  TASK_CATEGORIES.find((c) => c.value === value)?.label ?? "Uncategorised";
