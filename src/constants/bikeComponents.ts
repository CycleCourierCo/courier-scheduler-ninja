// Component catalogue + bike diagram hotspots for the Build My Bike service.

export const COMPONENT_CATEGORIES = [
  "Frame",
  "Fork",
  "Rear shock",
  "Headset",
  "Stem",
  "Handlebar",
  "Grips / bar tape",
  "Brake levers",
  "Shifters",
  "Groupset",
  "Front derailleur",
  "Rear derailleur",
  "Cassette",
  "Chain",
  "Crankset",
  "Chainring",
  "Bottom bracket",
  "Pedals",
  "Front brake",
  "Rear brake",
  "Brake rotors",
  "Brake pads",
  "Wheelset",
  "Front wheel",
  "Rear wheel",
  "Tyres",
  "Inner tubes",
  "Tubeless kit",
  "Seatpost",
  "Dropper post",
  "Dropper lever",
  "Saddle",
  "Seat clamp",
  "Headset spacers",
  "Cables & housing",
  "Bolt kit",
  "Bearings",
  "Motor",
  "Battery",
  "Display / controller",
  "Charger",
  "Mudguards",
  "Pannier rack",
  "Bottle cage",
  "Computer mount",
  "Kickstand",
  "Other",
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

/** Clickable areas on the bike diagram. Coordinates are percentages of the SVG box. */
export type BikeHotspot = {
  slot: string;
  label: string;
  x: number;
  y: number;
  /** Categories offered when picking stock for this slot. */
  categories: string[];
};

export const BIKE_HOTSPOTS: BikeHotspot[] = [
  { slot: "frame", label: "Frame", x: 50, y: 45, categories: ["Frame", "Rear shock", "Seat clamp", "Bearings"] },
  { slot: "fork", label: "Fork", x: 74, y: 52, categories: ["Fork"] },
  { slot: "cockpit", label: "Cockpit", x: 70, y: 22, categories: ["Handlebar", "Stem", "Headset", "Headset spacers", "Grips / bar tape", "Brake levers", "Shifters", "Computer mount"] },
  { slot: "drivetrain", label: "Drivetrain", x: 46, y: 70, categories: ["Groupset", "Crankset", "Chainring", "Bottom bracket", "Chain", "Cassette", "Front derailleur", "Rear derailleur", "Pedals", "Cables & housing"] },
  { slot: "brakes", label: "Brakes", x: 30, y: 40, categories: ["Front brake", "Rear brake", "Brake rotors", "Brake pads", "Cables & housing"] },
  { slot: "front-wheel", label: "Front wheel", x: 82, y: 78, categories: ["Wheelset", "Front wheel", "Tyres", "Inner tubes", "Tubeless kit"] },
  { slot: "rear-wheel", label: "Rear wheel", x: 16, y: 78, categories: ["Wheelset", "Rear wheel", "Tyres", "Inner tubes", "Tubeless kit"] },
  { slot: "seating", label: "Saddle & post", x: 33, y: 20, categories: ["Saddle", "Seatpost", "Dropper post", "Dropper lever", "Seat clamp"] },
  { slot: "electrics", label: "E-bike parts", x: 58, y: 60, categories: ["Motor", "Battery", "Display / controller", "Charger"] },
  { slot: "accessories", label: "Accessories", x: 24, y: 58, categories: ["Mudguards", "Pannier rack", "Bottle cage", "Kickstand", "Bolt kit", "Other"] },
];

/** Maps a component category to the diagram slot it belongs to, if any. */
export const slotForCategory = (category?: string | null): string | null =>
  BIKE_HOTSPOTS.find((h) => h.categories.includes(category || ""))?.slot ?? null;


export const BUILD_STAGES = [
  { value: "awaiting_build", label: "Awaiting build" },
  { value: "awaiting_parts", label: "Awaiting parts" },
  { value: "picking_parts", label: "Picking parts" },
  { value: "in_workshop", label: "Bike in workshop being built" },
  { value: "bike_built", label: "Bike built" },
  { value: "invoiced", label: "Invoiced" },
] as const;

export type BuildStage = (typeof BUILD_STAGES)[number]["value"];

export const BUILD_STAGE_LABELS: Record<BuildStage, string> = BUILD_STAGES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<BuildStage, string>
);

export const BUILD_STAGE_COLORS: Record<BuildStage, string> = {
  awaiting_build: "bg-muted text-muted-foreground",
  awaiting_parts: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  picking_parts: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_workshop: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  bike_built: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  invoiced: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};
