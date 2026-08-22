import type { UserRole } from "@/types/user";
import type { ReviewCategory } from "@/types/review";

export interface Competency {
  key: string;
  label: string;
  description?: string;
  category: ReviewCategory;
}

export interface CompetencyGroup {
  label: string;
  items: Competency[];
}

/** Behaviour & culture — everyone gets these (30% of the overall score) */
export const BEHAVIOUR_COMPETENCIES: Competency[] = [
  { key: "reliability", label: "Reliability", description: "Turns up, follows through, does what they say they will", category: "behaviour" },
  { key: "professionalism", label: "Professionalism", description: "Conduct, presentation and representation of the business", category: "behaviour" },
  { key: "teamwork", label: "Teamwork", description: "Supports colleagues and pulls their weight", category: "behaviour" },
  { key: "communication", label: "Communication", description: "Keeps the right people informed, clearly and in good time", category: "behaviour" },
  { key: "ownership", label: "Ownership", description: "Takes responsibility for problems rather than passing them on", category: "behaviour" },
  { key: "attitude", label: "Attitude", description: "Approach to work, feedback and change", category: "behaviour" },
  { key: "safety_mindset", label: "Safety mindset", description: "Works safely and challenges unsafe practice", category: "behaviour" },
  { key: "respect", label: "Respect for customers and colleagues", category: "behaviour" },
];

/** Core performance — everyone gets these (part of the 70%) */
export const CORE_PERFORMANCE_COMPETENCIES: Competency[] = [
  { key: "quality_of_work", label: "Quality of work", description: "Accuracy, care and standard of output", category: "performance" },
  { key: "productivity", label: "Productivity", description: "Volume of work completed to standard", category: "performance" },
  { key: "attendance", label: "Attendance and timekeeping", category: "performance" },
  { key: "systems_use", label: "Use of systems and process", description: "Records work correctly and follows SOPs", category: "performance" },
];

/** Role-specific performance competencies (part of the 70%) */
export const ROLE_COMPETENCIES: Partial<Record<UserRole, Competency[]>> = {
  driver: [
    { key: "driver_safe_driving", label: "Safe driving", description: "Driving standard, incidents, telematics", category: "performance" },
    { key: "driver_vehicle_checks", label: "Vehicle checks and vehicle care", category: "performance" },
    { key: "driver_delivery_quality", label: "Collection and delivery quality", description: "Bike handling, photos, paperwork, damage-free", category: "performance" },
    { key: "driver_timeslot_adherence", label: "Timeslot adherence", description: "Arriving within the promised window", category: "performance" },
    { key: "driver_fuel_route", label: "Fuel and route discipline", description: "Fuel card use, mileage, sticking to the planned route", category: "performance" },
    { key: "driver_customer_manner", label: "Customer manner on the doorstep", category: "performance" },
  ],
  mechanic: [
    { key: "mechanic_workmanship", label: "Workmanship quality", description: "Repairs done right first time", category: "performance" },
    { key: "mechanic_inspection_accuracy", label: "Inspection accuracy", description: "PDI findings match reality; nothing missed", category: "performance" },
    { key: "mechanic_throughput", label: "Throughput vs book time", description: "Earned hours against hours clocked", category: "performance" },
    { key: "mechanic_tidiness", label: "Workshop tidiness and tool care", category: "performance" },
    { key: "mechanic_parts", label: "Parts handling and stock discipline", category: "performance" },
  ],
  loader: [
    { key: "loader_loading_accuracy", label: "Loading accuracy", description: "Right bikes, right van, right order", category: "performance" },
    { key: "loader_storage_discipline", label: "Storage and bay discipline", description: "Bikes allocated and recorded in the correct bay", category: "performance" },
    { key: "loader_damage_prevention", label: "Damage prevention", description: "Careful handling, correct packing and strapping", category: "performance" },
    { key: "loader_pace", label: "Pace under pressure", category: "performance" },
  ],
  route_planner: [
    { key: "planner_route_quality", label: "Route quality", description: "Sensible, deliverable routes with realistic timings", category: "performance" },
    { key: "planner_utilisation", label: "Van utilisation", description: "Filling vans without overloading them", category: "performance" },
    { key: "planner_responsiveness", label: "Responsiveness to changes", description: "Handling failures, reschedules and late jobs", category: "performance" },
    { key: "planner_availability_management", label: "Availability management", description: "Chasing dates and keeping jobs moving", category: "performance" },
  ],
  cs_agent: [
    { key: "cs_response_time", label: "Response time", category: "performance" },
    { key: "cs_response_quality", label: "Response quality and tone", category: "performance" },
    { key: "cs_resolution", label: "First-contact resolution", description: "Sorting the issue without repeat contact", category: "performance" },
    { key: "cs_escalation", label: "Escalation judgement", category: "performance" },
  ],
  fleet_manager: [
    { key: "fleet_compliance", label: "Fleet compliance", description: "MOT, servicing, insurance, licences up to date", category: "performance" },
    { key: "fleet_downtime", label: "Vehicle downtime management", category: "performance" },
    { key: "fleet_cost_control", label: "Cost control", description: "Maintenance, fuel and repair spend", category: "performance" },
  ],
  sales: [
    { key: "sales_pipeline", label: "Pipeline and new accounts", category: "performance" },
    { key: "sales_account_care", label: "Existing account care", category: "performance" },
    { key: "sales_pricing_discipline", label: "Pricing discipline", category: "performance" },
  ],
  tech: [
    { key: "tech_delivery", label: "Delivery of technical work", category: "performance" },
    { key: "tech_reliability", label: "System reliability and monitoring", category: "performance" },
    { key: "tech_documentation", label: "Documentation and handover", category: "performance" },
  ],
  timeslip_admin: [
    { key: "timeslip_accuracy", label: "Timeslip accuracy", category: "performance" },
    { key: "timeslip_turnaround", label: "Turnaround and deadlines", category: "performance" },
  ],
};

export const ROLE_COMPETENCY_LABELS: Partial<Record<UserRole, string>> = {
  driver: "Driver",
  mechanic: "Mechanic",
  loader: "Loader",
  route_planner: "Route planner",
  cs_agent: "Customer service",
  fleet_manager: "Fleet manager",
  sales: "Sales",
  tech: "Tech",
  timeslip_admin: "Timeslip admin",
};

/** Build the competency set for a given set of roles */
export const buildCompetencyGroups = (roles: UserRole[]): CompetencyGroup[] => {
  const groups: CompetencyGroup[] = [
    { label: "Core performance", items: CORE_PERFORMANCE_COMPETENCIES },
  ];

  const seen = new Set<string>(CORE_PERFORMANCE_COMPETENCIES.map(c => c.key));
  for (const role of roles) {
    const items = (ROLE_COMPETENCIES[role] ?? []).filter(c => !seen.has(c.key));
    if (!items.length) continue;
    items.forEach(c => seen.add(c.key));
    groups.push({ label: `${ROLE_COMPETENCY_LABELS[role] ?? role} competencies`, items });
  }

  groups.push({ label: "Behaviour & culture", items: BEHAVIOUR_COMPETENCIES });
  return groups;
};

export const allCompetencies = (roles: UserRole[]): Competency[] =>
  buildCompetencyGroups(roles).flatMap(g => g.items);

export const competencyLabel = (key: string): string => {
  const all = [
    ...CORE_PERFORMANCE_COMPETENCIES,
    ...BEHAVIOUR_COMPETENCIES,
    ...Object.values(ROLE_COMPETENCIES).flatMap(v => v ?? []),
  ];
  return all.find(c => c.key === key)?.label ?? key;
};

export interface ReviewQuestion {
  key: string;
  label: string;
  placeholder?: string;
}

/** Employee self-assessment free-text questions */
export const SELF_ASSESSMENT_QUESTIONS: ReviewQuestion[] = [
  { key: "self_done_well", label: "What do you feel you have done particularly well?" },
  { key: "self_struggled", label: "What have you struggled with?" },
  { key: "self_improve", label: "What do you think you could improve?" },
  { key: "self_proudest", label: "What achievement are you most proud of during this review period?" },
  { key: "self_obstacles", label: "Have there been any obstacles affecting your performance?" },
  { key: "self_satisfaction", label: "How satisfied are you with your current role, and why?" },
  { key: "self_support", label: "What support do you need from the business?" },
  { key: "self_training", label: "What training or development would help you?" },
  { key: "self_goals", label: "What would you like to achieve before the next review?" },
];

/** Manager narrative questions */
export const MANAGER_QUESTIONS: ReviewQuestion[] = [
  { key: "mgr_strengths", label: "Key strengths during this period" },
  { key: "mgr_improvements", label: "Areas needing improvement" },
  { key: "mgr_previous_objectives", label: "Progress against previous objectives" },
  { key: "mgr_training", label: "Training and development plan" },
  { key: "mgr_summary", label: "Overall summary" },
];

export const PERFORMANCE_WEIGHT = 0.7;
export const BEHAVIOUR_WEIGHT = 0.3;
