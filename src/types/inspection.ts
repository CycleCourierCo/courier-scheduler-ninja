export type InspectionStatus =
  | 'pending'
  | 'inspected'
  | 'awaiting_pricing'
  | 'issues_found'
  | 'awaiting_parts'
  | 'awaiting_repair'
  | 'in_repair' // deprecated, kept for back-compat reads
  | 'repaired';

export type IssueStatus = 'pending' | 'approved' | 'declined' | 'resolved' | 'repaired';

export interface BicycleInspection {
  id: string;
  order_id: string;
  status: InspectionStatus;
  inspected_at: string | null;
  inspected_by_id: string | null;
  inspected_by_name: string | null;
  released_to_customer_at: string | null;
  released_by_id: string | null;
  released_by_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  issues?: InspectionIssue[];
}

export interface InspectionIssue {
  id: string;
  inspection_id: string;
  order_id: string;
  issue_description: string;
  estimated_cost: number | null;
  requested_by_id: string;
  requested_by_name: string;
  // Mechanic/admin-only part details
  part_name: string | null;
  part_spec: string | null;
  part_number: string | null;
  // Pricing audit
  priced_at: string | null;
  priced_by_id: string | null;
  priced_by_name: string | null;
  // Parts ordered tracking
  parts_ordered: boolean;
  parts_ordered_at: string | null;
  parts_ordered_by_id: string | null;
  parts_ordered_by_name: string | null;
  // Parts arrived tracking
  parts_arrived: boolean;
  parts_arrived_at: string | null;
  parts_arrived_by_id: string | null;
  parts_arrived_by_name: string | null;
  customer_response: string | null;
  customer_responded_at: string | null;
  status: IssueStatus;
  resolved_at: string | null;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionWithOrder extends BicycleInspection {
  order?: {
    id: string;
    tracking_number: string | null;
    bike_brand: string | null;
    bike_model: string | null;
    bike_quantity: number | null;
    status: string;
    sender: {
      name: string;
      email: string;
    };
    receiver: {
      name: string;
      email: string;
    };
    user_id: string;
  };
}
