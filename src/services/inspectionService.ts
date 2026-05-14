import { supabase } from "@/integrations/supabase/client";
import { BicycleInspection, InspectionIssue, InspectionStatus, IssueStatus } from "@/types/inspection";

// Fields that should never leak to non-admin/non-mechanic users.
const ADMIN_ONLY_ISSUE_FIELDS = [
  'part_name',
  'part_spec',
  'part_number',
  'priced_at',
  'priced_by_id',
  'priced_by_name',
] as const;

const stripAdminOnlyFromIssue = (issue: any) => {
  if (!issue) return issue;
  const cleaned: any = { ...issue };
  for (const f of ADMIN_ONLY_ISSUE_FIELDS) cleaned[f] = null;
  return cleaned;
};

// Reconcile inspection statuses based on the new multi-stage workflow.
// Customer-facing transitions only — admin gates (pricing release) stay manual.
export const reconcileInspectionStatuses = async (): Promise<number> => {
  try {
    const { data: inspections, error } = await supabase
      .from('bicycle_inspections')
      .select('id, status, inspection_issues(status, parts_arrived)')
      .in('status', ['issues_found', 'awaiting_parts', 'awaiting_repair', 'in_repair']);

    if (error) throw error;
    if (!inspections || inspections.length === 0) return 0;

    let updatedCount = 0;

    for (const inspection of inspections) {
      const issues = (inspection.inspection_issues as { status: string; parts_arrived: boolean }[]) || [];
      if (issues.length === 0) continue;

      let nextStatus: InspectionStatus | null = null;

      const allResponded = issues.every(i =>
        ['approved', 'declined', 'resolved', 'repaired'].includes(i.status)
      );
      const approved = issues.filter(i =>
        ['approved', 'resolved', 'repaired'].includes(i.status)
      );
      const allDeclined = allResponded && approved.length === 0;
      const allApprovedRepaired =
        approved.length > 0 && approved.every(i => i.status === 'repaired' || i.status === 'resolved');
      const allPartsArrived =
        approved.length > 0 && approved.every(i => i.parts_arrived === true);

      const currentStatus = inspection.status as InspectionStatus;

      if (currentStatus === 'issues_found' && allResponded) {
        nextStatus = allDeclined ? 'repaired' : 'awaiting_parts';
      } else if (currentStatus === 'awaiting_parts' && allPartsArrived) {
        nextStatus = 'awaiting_repair';
      } else if (
        (currentStatus === 'awaiting_repair' || currentStatus === 'in_repair') &&
        allApprovedRepaired
      ) {
        nextStatus = 'repaired';
      } else if (currentStatus === 'in_repair') {
        // Legacy rows: shift to awaiting_repair so the new UI handles them.
        nextStatus = 'awaiting_repair';
      }

      if (nextStatus && nextStatus !== currentStatus) {
        const { error: updateError } = await supabase
          .from('bicycle_inspections')
          .update({ status: nextStatus })
          .eq('id', inspection.id);
        if (!updateError) updatedCount++;
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('Error reconciling inspection statuses:', error);
    return 0;
  }
};

// Get or create inspection record for an order
export const getOrCreateInspection = async (orderId: string): Promise<BicycleInspection | null> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('bicycle_inspections')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      return existing as BicycleInspection;
    }

    const { data: newInspection, error: createError } = await supabase
      .from('bicycle_inspections')
      .insert({
        order_id: orderId,
        status: 'pending' as InspectionStatus,
      })
      .select()
      .single();

    if (createError) throw createError;

    return newInspection as BicycleInspection;
  } catch (error) {
    console.error('Error getting or creating inspection:', error);
    return null;
  }
};

// Enable inspection for an existing order (admin action)
export const enableInspectionForOrder = async (orderId: string): Promise<BicycleInspection | null> => {
  try {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ needs_inspection: true })
      .eq('id', orderId);

    if (orderError) throw orderError;

    const inspection = await getOrCreateInspection(orderId);
    return inspection;
  } catch (error) {
    console.error('Error enabling inspection for order:', error);
    throw error;
  }
};

// Get all pending inspections (admin only)
export const getPendingInspections = async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        tracking_number,
        bike_brand,
        bike_model,
        bike_quantity,
        status,
        sender,
        receiver,
        user_id,
        needs_inspection,
        storage_locations,
        customer_order_number,
        collection_confirmation_sent_at,
        created_at
      `)
      .eq('needs_inspection', true)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const orderIds = data?.map(o => o.id) || [];
    const { data: inspections, error: inspError } = await supabase
      .from('bicycle_inspections')
      .select('*, inspection_issues(*)')
      .in('order_id', orderIds);

    if (inspError) throw inspError;

    return data?.map(order => ({
      ...order,
      inspection: inspections?.find(i => i.order_id === order.id) || null,
      issues: inspections?.find(i => i.order_id === order.id)?.inspection_issues || []
    })) || [];
  } catch (error) {
    console.error('Error fetching pending inspections:', error);
    return [];
  }
};

// Get inspections for user's orders (customer view).
// Hides part details and pricing audit fields, and any inspection still in awaiting_pricing.
export const getMyInspections = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        tracking_number,
        bike_brand,
        bike_model,
        bike_quantity,
        status,
        sender,
        receiver,
        user_id,
        needs_inspection,
        storage_locations,
        customer_order_number,
        collection_confirmation_sent_at,
        created_at
      `)
      .eq('user_id', userId)
      .eq('needs_inspection', true)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const orderIds = data?.map(o => o.id) || [];
    if (orderIds.length === 0) return [];

    const { data: inspections, error: inspError } = await supabase
      .from('bicycle_inspections')
      .select('*, inspection_issues(*)')
      .in('order_id', orderIds);

    if (inspError) throw inspError;

    return data?.map(order => {
      const insp = inspections?.find(i => i.order_id === order.id);
      // Hide inspection from customer until admin has released it
      const visibleInsp = insp && (insp as any).released_to_customer_at ? insp : null;
      const rawIssues = visibleInsp?.inspection_issues || [];
      const sanitisedIssues = (rawIssues as any[]).map(stripAdminOnlyFromIssue);
      return {
        ...order,
        inspection: visibleInsp
          ? { ...visibleInsp, inspection_issues: sanitisedIssues }
          : null,
        issues: sanitisedIssues,
      };
    }) || [];
  } catch (error) {
    console.error('Error fetching my inspections:', error);
    return [];
  }
};

// Mark bike as inspected (no issues path)
export const markAsInspected = async (
  orderId: string,
  inspectorId: string,
  inspectorName: string,
  notes?: string
): Promise<BicycleInspection | null> => {
  try {
    const inspection = await getOrCreateInspection(orderId);
    if (!inspection) throw new Error('Failed to get or create inspection');

    const now = new Date().toISOString();
    // No issues → release straight to customer (no admin pricing step needed)
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({
        status: 'inspected' as InspectionStatus,
        inspected_at: now,
        inspected_by_id: inspectorId,
        inspected_by_name: inspectorName,
        released_to_customer_at: now,
        released_by_id: inspectorId,
        released_by_name: inspectorName,
        notes: notes || null,
      })
      .eq('id', inspection.id)
      .select()
      .single();

    if (error) throw error;

    return data as BicycleInspection;
  } catch (error) {
    console.error('Error marking as inspected:', error);
    throw error;
  }
};

// Add inspection issue (mechanic reports issue with optional part info).
// Moves inspection into awaiting_pricing — customer does not see it yet.
export const addInspectionIssue = async (
  orderId: string,
  issueDescription: string,
  estimatedCost: number | null,
  requestedById: string,
  requestedByName: string,
  partInfo?: { part_name?: string | null; part_spec?: string | null; part_number?: string | null }
): Promise<InspectionIssue | null> => {
  try {
    const inspection = await getOrCreateInspection(orderId);
    if (!inspection) throw new Error('Failed to get or create inspection');

    await supabase
      .from('bicycle_inspections')
      .update({
        status: 'awaiting_pricing' as InspectionStatus,
        inspected_at: new Date().toISOString(),
        inspected_by_id: requestedById,
        inspected_by_name: requestedByName,
      })
      .eq('id', inspection.id);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('inspection_issues')
      .insert({
        inspection_id: inspection.id,
        order_id: orderId,
        issue_description: issueDescription,
        estimated_cost: estimatedCost,
        requested_by_id: requestedById,
        requested_by_name: requestedByName,
        status: 'pending' as IssueStatus,
        part_name: partInfo?.part_name || null,
        part_spec: partInfo?.part_spec || null,
        part_number: partInfo?.part_number || null,
        // If mechanic also entered a price, treat it as priced now.
        priced_at: estimatedCost != null ? now : null,
        priced_by_id: estimatedCost != null ? requestedById : null,
        priced_by_name: estimatedCost != null ? requestedByName : null,
      })
      .select()
      .single();

    if (error) throw error;

    return data as InspectionIssue;
  } catch (error) {
    console.error('Error adding inspection issue:', error);
    throw error;
  }
};

// Admin sets/updates the price for an issue
export const setIssuePrice = async (
  issueId: string,
  price: number,
  pricedById: string,
  pricedByName: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        estimated_cost: price,
        priced_at: new Date().toISOString(),
        priced_by_id: pricedById,
        priced_by_name: pricedByName,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error setting issue price:', error);
    throw error;
  }
};

// Admin releases inspection to customer — moves from awaiting_pricing to issues_found.
// Requires every issue to have a price.
export const releaseInspectionToCustomer = async (
  inspectionId: string,
  releasedById: string,
  releasedByName: string
): Promise<BicycleInspection | null> => {
  try {
    const { data: issues, error: issuesError } = await supabase
      .from('inspection_issues')
      .select('id, estimated_cost')
      .eq('inspection_id', inspectionId);

    if (issuesError) throw issuesError;
    if (!issues || issues.length === 0) {
      throw new Error('No issues found for this inspection');
    }
    const missingPrice = issues.find(i => i.estimated_cost == null);
    if (missingPrice) {
      throw new Error('All issues must have a price before releasing to the customer');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({
        status: 'issues_found' as InspectionStatus,
        released_to_customer_at: now,
        released_by_id: releasedById,
        released_by_name: releasedByName,
      })
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    return data as BicycleInspection;
  } catch (error) {
    console.error('Error releasing inspection to customer:', error);
    throw error;
  }
};

// Submit customer response to issue
export const submitCustomerResponse = async (
  issueId: string,
  response: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        customer_response: response,
        customer_responded_at: new Date().toISOString(),
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error submitting customer response:', error);
    throw error;
  }
};

// Resolve issue (admin only)
export const resolveIssue = async (
  issueId: string,
  resolverId: string,
  resolverName: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        status: 'resolved' as IssueStatus,
        resolved_at: new Date().toISOString(),
        resolved_by_id: resolverId,
        resolved_by_name: resolverName,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error resolving issue:', error);
    throw error;
  }
};

// Reset inspection back to pending
export const resetToPending = async (
  inspectionId: string
): Promise<BicycleInspection | null> => {
  try {
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({
        status: 'pending' as InspectionStatus,
        inspected_at: null,
        inspected_by_id: null,
        inspected_by_name: null,
        released_to_customer_at: null,
        released_by_id: null,
        released_by_name: null,
        notes: null,
      })
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    return data as BicycleInspection;
  } catch (error) {
    console.error('Error resetting inspection to pending:', error);
    throw error;
  }
};

// Accept issue (customer approves the repair)
export const acceptIssue = async (issueId: string): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        status: 'approved' as IssueStatus,
        customer_response: 'Approved',
        customer_responded_at: new Date().toISOString(),
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error accepting issue:', error);
    throw error;
  }
};

// Decline issue (customer rejects the repair)
export const declineIssue = async (
  issueId: string,
  reason?: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        status: 'declined' as IssueStatus,
        customer_response: reason || 'Declined',
        customer_responded_at: new Date().toISOString(),
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error declining issue:', error);
    throw error;
  }
};

// Mark a part as arrived for an issue (mechanic/admin)
export const markPartsArrived = async (
  issueId: string,
  byId: string,
  byName: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        parts_arrived: true,
        parts_arrived_at: new Date().toISOString(),
        parts_arrived_by_id: byId,
        parts_arrived_by_name: byName,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error marking parts arrived:', error);
    throw error;
  }
};

export const unmarkPartsArrived = async (issueId: string): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        parts_arrived: false,
        parts_arrived_at: null,
        parts_arrived_by_id: null,
        parts_arrived_by_name: null,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error unmarking parts arrived:', error);
    throw error;
  }
};

// Move to "Awaiting Repair" status (legacy alias kept for invoice/reuse callers)
export const moveToInRepair = async (inspectionId: string): Promise<BicycleInspection | null> => {
  try {
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({ status: 'awaiting_repair' as InspectionStatus })
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    return data as BicycleInspection;
  } catch (error) {
    console.error('Error moving to awaiting_repair:', error);
    throw error;
  }
};

// Mark issue as repaired (admin/mechanic action)
export const markIssueRepaired = async (
  issueId: string,
  repairerId: string,
  repairerName: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        status: 'repaired' as IssueStatus,
        resolved_at: new Date().toISOString(),
        resolved_by_id: repairerId,
        resolved_by_name: repairerName,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error marking issue as repaired:', error);
    throw error;
  }
};

// Move to "Repaired" status
export const moveToRepaired = async (inspectionId: string): Promise<BicycleInspection | null> => {
  try {
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({ status: 'repaired' as InspectionStatus })
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    return data as BicycleInspection;
  } catch (error) {
    console.error('Error moving to repaired:', error);
    throw error;
  }
};

// Check if all issues have been responded to by customer
export const checkAllIssuesResolved = (issues: InspectionIssue[]): boolean => {
  return issues.length > 0 && issues.every(
    issue => issue.status === 'approved' || issue.status === 'declined' || issue.status === 'repaired' || issue.status === 'resolved'
  );
};

// Check if all approved issues are repaired
export const checkAllApprovedRepaired = (issues: InspectionIssue[]): boolean => {
  const approvedIssues = issues.filter(i => i.status === 'approved' || i.status === 'repaired');
  if (approvedIssues.length === 0) return true;
  return approvedIssues.every(issue => issue.status === 'repaired');
};

// Check if all approved issues have parts arrived
export const checkAllPartsArrived = (issues: InspectionIssue[]): boolean => {
  const approvedIssues = issues.filter(i => i.status === 'approved' || i.status === 'repaired' || i.status === 'resolved');
  if (approvedIssues.length === 0) return false;
  return approvedIssues.every(issue => !!issue.parts_arrived || issue.status === 'repaired' || issue.status === 'resolved');
};

// Get inspection status for an order (for badges on job scheduling)
export const getInspectionStatusForOrder = async (orderId: string): Promise<{
  status: InspectionStatus | null;
  hasOpenIssues: boolean;
} | null> => {
  try {
    const { data: inspection, error } = await supabase
      .from('bicycle_inspections')
      .select('status, inspection_issues(status)')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) throw error;

    if (!inspection) {
      return { status: null, hasOpenIssues: false };
    }

    const openIssues = (inspection.inspection_issues as any[])?.filter(
      (issue: any) => issue.status === 'pending'
    ) || [];

    return {
      status: inspection.status as InspectionStatus,
      hasOpenIssues: openIssues.length > 0,
    };
  } catch (error) {
    console.error('Error getting inspection status:', error);
    return null;
  }
};
