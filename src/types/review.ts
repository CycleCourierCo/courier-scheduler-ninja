export type ReviewType = "probation" | "monthly" | "quarterly" | "six_month" | "annual" | "ad_hoc";

export type ReviewStage =
  | "draft"
  | "self_assessment"
  | "manager_assessment"
  | "review_meeting"
  | "objectives"
  | "employee_response"
  | "signed_off";

export type ReviewSource = "self" | "manager";
export type ReviewCategory = "performance" | "behaviour";
export type ReviewActionOwner = "employee" | "manager";
export type ReviewActionStatus = "not_started" | "in_progress" | "complete";
export type ReviewAgreement = "agree" | "agree_with_comments" | "disagree";

export interface ReviewPerson {
  id: string;
  name: string | null;
  email: string | null;
}

export interface ReviewCycle {
  id: string;
  employee_id: string;
  reviewer_id: string | null;
  created_by: string | null;
  review_type: ReviewType;
  period_start: string;
  period_end: string;
  review_date: string | null;
  stage: ReviewStage;
  meeting_notes: string | null;
  employee_agreement: ReviewAgreement | null;
  employee_comments: string | null;
  employee_requests_discussion: boolean;
  employee_acknowledged_at: string | null;
  performance_score: number | null;
  behaviour_score: number | null;
  overall_score: number | null;
  self_overall_score: number | null;
  self_submitted_at: string | null;
  manager_submitted_at: string | null;
  signed_off_at: string | null;
  signed_off_by: string | null;
  created_at: string;
  updated_at: string;
  employee?: ReviewPerson | null;
  reviewer?: ReviewPerson | null;
}

export interface ReviewRating {
  id: string;
  cycle_id: string;
  competency_key: string;
  category: ReviewCategory;
  source: ReviewSource;
  score: number | null;
  comment: string | null;
}

export interface ReviewResponse {
  id: string;
  cycle_id: string;
  question_key: string;
  source: ReviewSource;
  answer: string | null;
}

export interface ReviewAction {
  id: string;
  cycle_id: string;
  description: string;
  owner: ReviewActionOwner;
  due_date: string | null;
  status: ReviewActionStatus;
  completed_at: string | null;
}

export interface ReviewFilters {
  employeeId?: string;
  reviewType?: ReviewType | "all";
  stage?: ReviewStage | "all" | "active";
  from?: string;
  to?: string;
  search?: string;
}

export interface ReviewBundle {
  cycle: ReviewCycle;
  ratings: ReviewRating[];
  responses: ReviewResponse[];
  actions: ReviewAction[];
}

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  probation: "Probation",
  monthly: "Monthly",
  quarterly: "Quarterly",
  six_month: "6-month",
  annual: "Annual",
  ad_hoc: "Ad-hoc / performance issue",
};

export const REVIEW_STAGE_LABELS: Record<ReviewStage, string> = {
  draft: "Draft",
  self_assessment: "Self-assessment",
  manager_assessment: "Manager assessment",
  review_meeting: "Review meeting",
  objectives: "Agreed objectives",
  employee_response: "Employee response",
  signed_off: "Signed off",
};

export const REVIEW_STAGE_ORDER: ReviewStage[] = [
  "draft",
  "self_assessment",
  "manager_assessment",
  "review_meeting",
  "objectives",
  "employee_response",
  "signed_off",
];

export const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Needs improvement",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};

export const ACTION_STATUS_LABELS: Record<ReviewActionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

export const AGREEMENT_LABELS: Record<ReviewAgreement, string> = {
  agree: "Agree",
  agree_with_comments: "Agree with comments",
  disagree: "Disagree",
};
