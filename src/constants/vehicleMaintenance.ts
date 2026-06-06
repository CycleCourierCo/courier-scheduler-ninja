export type ServiceType = "oil_filter" | "tyre" | "brake_pads" | "brake_discs" | "other";
export type ServicePosition =
  | "front_left"
  | "front_right"
  | "rear_left"
  | "rear_right"
  | "spare"
  | "front_axle"
  | "rear_axle";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  oil_filter: "Oil & filter",
  tyre: "Tyre",
  brake_pads: "Brake pads",
  brake_discs: "Brake discs",
  other: "Other",
};

export const POSITION_LABELS: Record<ServicePosition, string> = {
  front_left: "Front-Left",
  front_right: "Front-Right",
  rear_left: "Rear-Left",
  rear_right: "Rear-Right",
  spare: "Spare",
  front_axle: "Front axle",
  rear_axle: "Rear axle",
};

export const TYRE_POSITIONS: ServicePosition[] = [
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
  "spare",
];

export const BRAKE_POSITIONS: ServicePosition[] = ["front_axle", "rear_axle"];

export interface IntervalDefault {
  serviceType: ServiceType;
  position?: ServicePosition;
  miles: number | null;
  months: number | null;
}

export const DEFAULT_INTERVALS: IntervalDefault[] = [
  { serviceType: "oil_filter", miles: 10000, months: 12 },
  { serviceType: "tyre", position: "front_left", miles: 20000, months: 36 },
  { serviceType: "tyre", position: "front_right", miles: 20000, months: 36 },
  { serviceType: "tyre", position: "rear_left", miles: 25000, months: 36 },
  { serviceType: "tyre", position: "rear_right", miles: 25000, months: 36 },
  { serviceType: "tyre", position: "spare", miles: null, months: 60 },
  { serviceType: "brake_pads", position: "front_axle", miles: 25000, months: 24 },
  { serviceType: "brake_pads", position: "rear_axle", miles: 40000, months: 36 },
  { serviceType: "brake_discs", position: "front_axle", miles: 50000, months: 48 },
  { serviceType: "brake_discs", position: "rear_axle", miles: 50000, months: 48 },
];

export const formatServiceLabel = (
  serviceType: ServiceType,
  position?: ServicePosition | null,
  customName?: string | null,
): string => {
  if (serviceType === "other") return customName?.trim() || "Other";
  const base = SERVICE_TYPE_LABELS[serviceType];
  return position ? `${base} — ${POSITION_LABELS[position]}` : base;
};
