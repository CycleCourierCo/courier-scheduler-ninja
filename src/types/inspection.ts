export type InspectionStatus = 'pending' | 'inspected' | 'issues_found';
export type IssueStatus = 'pending' | 'approved' | 'declined' | 'resolved';

export interface BicycleInspection {
  id: string;
  order_id: string;
  status: InspectionStatus;
  inspected_at: string | null;
  inspected_by_id: string | null;
  inspected_by_name: string | null;
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
