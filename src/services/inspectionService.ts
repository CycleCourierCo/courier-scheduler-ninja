import { supabase } from "@/integrations/supabase/client";
import { BicycleInspection, InspectionIssue, InspectionStatus, IssueStatus } from "@/types/inspection";

// Get or create inspection record for an order
export const getOrCreateInspection = async (orderId: string): Promise<BicycleInspection | null> => {
  try {
    // First try to get existing inspection
    const { data: existing, error: fetchError } = await supabase
      .from('bicycle_inspections')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    
    if (existing) {
      return existing as BicycleInspection;
    }

    // Create new inspection record
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
        needs_inspection
      `)
      .eq('needs_inspection', true)
      .not('status', 'in', '("delivered","cancelled")')
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // Get inspections for these orders
    const orderIds = data?.map(o => o.id) || [];
    const { data: inspections, error: inspError } = await supabase
      .from('bicycle_inspections')
      .select('*, inspection_issues(*)')
      .in('order_id', orderIds);

    if (inspError) throw inspError;

    // Combine orders with their inspections
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

// Get inspections for user's orders (customer view)
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
        needs_inspection
      `)
      .eq('user_id', userId)
      .eq('needs_inspection', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Get inspections for these orders
    const orderIds = data?.map(o => o.id) || [];
    if (orderIds.length === 0) return [];
    
    const { data: inspections, error: inspError } = await supabase
      .from('bicycle_inspections')
      .select('*, inspection_issues(*)')
      .in('order_id', orderIds);

    if (inspError) throw inspError;

    // Combine orders with their inspections
    return data?.map(order => ({
      ...order,
      inspection: inspections?.find(i => i.order_id === order.id) || null,
      issues: inspections?.find(i => i.order_id === order.id)?.inspection_issues || []
    })) || [];
  } catch (error) {
    console.error('Error fetching my inspections:', error);
    return [];
  }
};

// Mark bike as inspected
export const markAsInspected = async (
  orderId: string,
  inspectorId: string,
  inspectorName: string,
  notes?: string
): Promise<BicycleInspection | null> => {
  try {
    // Get or create inspection
    const inspection = await getOrCreateInspection(orderId);
    if (!inspection) throw new Error('Failed to get or create inspection');

    // Update to inspected
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({
        status: 'inspected' as InspectionStatus,
        inspected_at: new Date().toISOString(),
        inspected_by_id: inspectorId,
        inspected_by_name: inspectorName,
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

// Add inspection issue (attention request)
export const addInspectionIssue = async (
  orderId: string,
  issueDescription: string,
  estimatedCost: number | null,
  requestedById: string,
  requestedByName: string
): Promise<InspectionIssue | null> => {
  try {
    // Get or create inspection
    const inspection = await getOrCreateInspection(orderId);
    if (!inspection) throw new Error('Failed to get or create inspection');

    // Update inspection status to issues_found
    await supabase
      .from('bicycle_inspections')
      .update({
        status: 'issues_found' as InspectionStatus,
        inspected_at: new Date().toISOString(),
        inspected_by_id: requestedById,
        inspected_by_name: requestedByName,
      })
      .eq('id', inspection.id);

    // Create the issue
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

// Reset inspection back to pending (awaiting inspection)
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
    
    // After accepting, check if we should move inspection to in_repair
    if (data) {
      await checkAndMoveToInRepair(data.inspection_id);
    }
    
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
    
    // After declining, check if we should move inspection to in_repair
    if (data) {
      await checkAndMoveToInRepair(data.inspection_id);
    }
    
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error declining issue:', error);
    throw error;
  }
};

// Check if all issues are responded and move to in_repair
export const checkAndMoveToInRepair = async (inspectionId: string): Promise<void> => {
  try {
    // Get all issues for this inspection
    const { data: issues, error } = await supabase
      .from('inspection_issues')
      .select('status')
      .eq('inspection_id', inspectionId);

    if (error) throw error;

    // Check if all issues have been responded to (approved or declined)
    const allResolved = issues && issues.length > 0 && issues.every(
      issue => issue.status === 'approved' || issue.status === 'declined' || issue.status === 'repaired' || issue.status === 'resolved'
    );

    if (allResolved) {
      await supabase
        .from('bicycle_inspections')
        .update({ status: 'in_repair' as InspectionStatus })
        .eq('id', inspectionId);
    }
  } catch (error) {
    console.error('Error checking/moving to in_repair:', error);
  }
};

// Move to "In Repair" status
export const moveToInRepair = async (inspectionId: string): Promise<BicycleInspection | null> => {
  try {
    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({ status: 'in_repair' as InspectionStatus })
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    
    return data as BicycleInspection;
  } catch (error) {
    console.error('Error moving to in_repair:', error);
    throw error;
  }
};

// Mark issue as repaired (admin action)
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
  // If no approved issues exist (all declined), consider it complete
  if (approvedIssues.length === 0) return true;
  return approvedIssues.every(issue => issue.status === 'repaired');
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
