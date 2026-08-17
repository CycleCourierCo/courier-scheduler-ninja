import { pushIssueStatusToInspectaBike } from '@/services/inspectabikeService';
import { supabase } from "@/integrations/supabase/client";
import { BicycleInspection, InspectionIssue, InspectionStatus, IssueStatus } from "@/types/inspection";
import { resendReceiverAvailabilityEmail } from "./emailService";

// Returns true when the receiver availability flow should be deferred because
// the bike still needs inspection / repair. Used by every code path that would
// otherwise email the receiver or move the order into receiver_availability_pending.
export const isReceiverAvailabilityBlockedByInspection = async (
  orderId: string
): Promise<boolean> => {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('needs_inspection')
      .eq('id', orderId)
      .maybeSingle();
    if (!order || (order as any).needs_inspection !== true) return false;

    // Inspection considered complete when there's an inspection row that is
    // either 'inspected' (no-issues path) or 'repaired' (all approved repairs
    // done / every issue declined).
    const { data: inspections } = await supabase
      .from('bicycle_inspections')
      .select('status')
      .eq('order_id', orderId);

    const isComplete = (inspections || []).some(
      (i: any) => i.status === 'repaired' || i.status === 'inspected'
    );
    return !isComplete;
  } catch (err) {
    console.error('Error checking inspection block for receiver availability:', err);
    // Fail safe: block when uncertain
    return true;
  }
};

// When an inspection transitions to 'repaired' (all approved issues repaired,
// or every issue declined), trigger receiver availability email if it hasn't
// been sent yet. This is the deferred handoff for orders with needs_inspection.
const triggerReceiverAvailabilityIfDeferred = async (inspectionId: string): Promise<void> => {
  try {
    const { data: inspection } = await supabase
      .from('bicycle_inspections')
      .select('order_id')
      .eq('id', inspectionId)
      .maybeSingle();
    if (!inspection?.order_id) return;

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, needs_inspection, delivery_date')
      .eq('id', inspection.order_id)
      .maybeSingle();
    if (!order) return;

    const needsInspection = (order as any).needs_inspection === true;
    const hasReceiverDates = Array.isArray((order as any).delivery_date) && (order as any).delivery_date.length > 0;
    // Idempotency guard: only fire when this is an inspection order and the
    // receiver hasn't picked dates yet. Do NOT gate on order.status — by the
    // time inspection completes the order is usually further along (collected,
    // at_depot, etc.) and gating here would suppress the email indefinitely.
    if (!needsInspection) return;
    if (hasReceiverDates) return;

    // Only nudge status forward when we're still in the pre-receiver phase.
    // For more-advanced statuses (collected, at_depot, ...), leave status alone
    // so we don't move the order backwards.
    const currentStatus = (order as any).status;
    if (['sender_availability_confirmed', 'receiver_availability_pending'].includes(currentStatus)) {
      await supabase
        .from('orders')
        .update({
          status: 'receiver_availability_pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }

    const sent = await resendReceiverAvailabilityEmail(order.id);
    console.log('Post-inspection receiver availability email sent:', sent, 'for order:', order.id);
  } catch (err) {
    console.error('Error triggering post-inspection receiver availability email:', err);
  }
};


// Fields that should never leak to non-admin/non-mechanic users.
const ADMIN_ONLY_ISSUE_FIELDS = [
  'part_name',
  'part_spec',
  'part_number',
  'priced_at',
  'priced_by_id',
  'priced_by_name',
  'parts_ordered_at',
  'parts_ordered_by_id',
  'parts_ordered_by_name',
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
      .select('id, status, inspection_issues(status, parts_arrived, parts_ordered)')
      .in('status', ['issues_found', 'awaiting_parts', 'awaiting_repair', 'in_repair']);

    if (error) throw error;
    if (!inspections || inspections.length === 0) return 0;

    let updatedCount = 0;

    for (const inspection of inspections) {
      const issues = (inspection.inspection_issues as { status: string; parts_arrived: boolean; parts_ordered: boolean }[]) || [];
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
      const allPartsReady =
        approved.length > 0 && approved.every(i => i.parts_arrived === true && i.parts_ordered === true);

      const currentStatus = inspection.status as InspectionStatus;

      if (currentStatus === 'issues_found' && allResponded) {
        nextStatus = allDeclined ? 'repaired' : 'awaiting_parts';
      } else if (currentStatus === 'awaiting_parts' && allPartsReady) {
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
        if (!updateError) {
          updatedCount++;
          if (nextStatus === 'repaired') {
            await triggerReceiverAvailabilityIfDeferred(inspection.id);
          }
        }
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('Error reconciling inspection statuses:', error);
    return 0;
  }
};

// Get or create inspection record for an order. If a bikeType is provided and
// the inspection either doesn't exist yet or has no bike_type set, it's persisted.
export const getOrCreateInspection = async (
  orderId: string,
  bikeType?: string | null
): Promise<BicycleInspection | null> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('bicycle_inspections')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      if (bikeType && !(existing as any).bike_type) {
        const { data: updated } = await supabase
          .from('bicycle_inspections')
          .update({ bike_type: bikeType } as any)
          .eq('id', (existing as any).id)
          .select()
          .single();
        return (updated ?? existing) as BicycleInspection;
      }
      return existing as BicycleInspection;
    }

    const { data: newInspection, error: createError } = await supabase
      .from('bicycle_inspections')
      .insert({
        order_id: orderId,
        status: 'pending' as InspectionStatus,
        ...(bikeType ? { bike_type: bikeType } : {}),
      } as any)
      .select()
      .single();

    if (createError) throw createError;

    return newInspection as BicycleInspection;
  } catch (error) {
    console.error('Error getting or creating inspection:', error);
    return null;
  }
};

// Update the bike category on an inspection (admin/mechanic during pricing/inspection)
export const updateInspectionBikeType = async (
  inspectionId: string,
  bikeType: string | null
): Promise<void> => {
  const { error } = await supabase
    .from('bicycle_inspections')
    .update({ bike_type: bikeType } as any)
    .eq('id', inspectionId);
  if (error) throw error;
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
        pickup_date,
        created_at,
        tracking_events
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

    // Look up booking-account names so the UI can filter/label by customer.
    const userIds = Array.from(new Set((data || []).map(o => o.user_id).filter(Boolean))) as string[];
    let profileMap = new Map<string, { name: string | null; email: string | null; company: string | null }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email, company_name')
        .in('id', userIds);
      profileMap = new Map(
        (profs || []).map(p => [p.id, { name: p.name ?? null, email: p.email ?? null, company: p.company_name ?? null }])
      );
    }

    return data?.map(order => {
      const prof = order.user_id ? profileMap.get(order.user_id) : undefined;
      return {
        ...order,
        booking_customer_name: prof?.company || prof?.name || prof?.email || null,
        booking_customer_email: prof?.email || null,
        inspection: inspections?.find(i => i.order_id === order.id) || null,
        issues: inspections?.find(i => i.order_id === order.id)?.inspection_issues || []
      };
    }) || [];

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
        pickup_date,
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

// Mark bike as inspected (no issues path). If cleaning tasks aren't finished,
// the row goes to the internal 'cleaning' stage instead — invisible on customer
// tracking; auto-promotes to 'inspected' once cleaning is completed.
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
    const cleaningDone =
      !!(inspection as any).frame_cleaned_at && !!(inspection as any).drivetrain_degreased_at;

    const patch: any = {
      inspected_at: now,
      inspected_by_id: inspectorId,
      inspected_by_name: inspectorName,
      notes: notes || null,
    };
    if (cleaningDone) {
      patch.status = 'inspected' as InspectionStatus;
      patch.released_to_customer_at = now;
      patch.released_by_id = inspectorId;
      patch.released_by_name = inspectorName;
    } else {
      patch.status = 'cleaning' as InspectionStatus;
    }

    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update(patch)
      .eq('id', inspection.id)
      .select()
      .single();

    if (error) throw error;

    if (cleaningDone) {
      // No-issues + clean path completes the inspection; trigger any deferred
      // receiver availability email now.
      await triggerReceiverAvailabilityIfDeferred(inspection.id);
    }

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
  partInfo?: { part_name?: string | null; part_spec?: string | null; part_number?: string | null },
  extra?: {
    bike_type?: string | null;
    repair_id?: string | null;
    parts_cost?: number | null;
    labour_cost?: number | null;
  }
): Promise<InspectionIssue | null> => {
  try {
    const inspection = await getOrCreateInspection(orderId, extra?.bike_type ?? null);
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
    const hasSplit = extra?.parts_cost != null || extra?.labour_cost != null;
    const hasAnyPrice = estimatedCost != null || hasSplit;
    const { data, error } = await supabase
      .from('inspection_issues')
      .insert({
        inspection_id: inspection.id,
        order_id: orderId,
        issue_description: issueDescription,
        estimated_cost: estimatedCost,
        parts_cost: extra?.parts_cost ?? null,
        labour_cost: extra?.labour_cost ?? null,
        repair_id: extra?.repair_id ?? null,
        requested_by_id: requestedById,
        requested_by_name: requestedByName,
        status: 'pending' as IssueStatus,
        part_name: partInfo?.part_name || null,
        part_spec: partInfo?.part_spec || null,
        part_number: partInfo?.part_number || null,
        priced_at: hasAnyPrice ? now : null,
        priced_by_id: hasAnyPrice ? requestedById : null,
        priced_by_name: hasAnyPrice ? requestedByName : null,
      } as any)
      .select()
      .single();

    if (error) throw error;

    return data as InspectionIssue;
  } catch (error) {
    console.error('Error adding inspection issue:', error);
    throw error;
  }
};

// Admin sets/updates the price for an issue (split into parts + labour).
// estimated_cost is auto-computed by DB trigger as parts + labour.
export const setIssuePrice = async (
  issueId: string,
  partsCost: number,
  labourCost: number,
  pricedById: string,
  pricedByName: string,
  repairId?: string | null
): Promise<InspectionIssue | null> => {
  try {
    const update: Record<string, any> = {
      parts_cost: partsCost,
      labour_cost: labourCost,
      priced_at: new Date().toISOString(),
      priced_by_id: pricedById,
      priced_by_name: pricedByName,
    };
    if (repairId !== undefined) update.repair_id = repairId;
    const { data, error } = await supabase
      .from('inspection_issues')
      .update(update)
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
    pushIssueStatusToInspectaBike(issueId);
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
    pushIssueStatusToInspectaBike(issueId);
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error declining issue:', error);
    throw error;
  }
};

// Mark a part as ordered for an issue (mechanic/admin)
export const markPartsOrdered = async (
  issueId: string,
  byId: string,
  byName: string
): Promise<InspectionIssue | null> => {
  try {
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        parts_ordered: true,
        parts_ordered_at: new Date().toISOString(),
        parts_ordered_by_id: byId,
        parts_ordered_by_name: byName,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    pushIssueStatusToInspectaBike(issueId);
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error marking parts ordered:', error);
    throw error;
  }
};

export const unmarkPartsOrdered = async (issueId: string): Promise<InspectionIssue | null> => {
  try {
    // Unmarking ordered also clears arrived (can't have arrived without being ordered)
    const { data, error } = await supabase
      .from('inspection_issues')
      .update({
        parts_ordered: false,
        parts_ordered_at: null,
        parts_ordered_by_id: null,
        parts_ordered_by_name: null,
        parts_arrived: false,
        parts_arrived_at: null,
        parts_arrived_by_id: null,
        parts_arrived_by_name: null,
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    pushIssueStatusToInspectaBike(issueId);
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error unmarking parts ordered:', error);
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
    pushIssueStatusToInspectaBike(issueId);
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
    pushIssueStatusToInspectaBike(issueId);
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error unmarking parts arrived:', error);
    throw error;
  }
};

// Mark an inspection as deliberately not invoiced (admin decision)
export const markInvoiceNotNeeded = async (
  inspectionId: string,
  reason: string | null,
  markedBy: { id?: string | null; name?: string | null }
) => {
  const { data, error } = await supabase
    .from('bicycle_inspections')
    .update({
      invoice_skipped_at: new Date().toISOString(),
      invoice_skipped_by_id: markedBy?.id || null,
      invoice_skipped_by_name: markedBy?.name || null,
      invoice_skip_reason: reason?.trim() || null,
    })
    .eq('id', inspectionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Undo the "no invoice needed" decision so the job becomes invoiceable again
export const clearInvoiceSkip = async (inspectionId: string) => {
  const { data, error } = await supabase
    .from('bicycle_inspections')
    .update({
      invoice_skipped_at: null,
      invoice_skipped_by_id: null,
      invoice_skipped_by_name: null,
      invoice_skip_reason: null,
    })
    .eq('id', inspectionId)
    .select()
    .single();

  if (error) throw error;
  return data;
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

// Move to "Repaired" status — or to the internal 'cleaning' stage if cleaning
// tasks aren't done yet. Cleaning stage is invisible on customer tracking and
// auto-promotes to 'repaired' when both cleaning tasks are ticked.
export const moveToRepaired = async (inspectionId: string): Promise<BicycleInspection | null> => {
  try {
    const { data: current } = await supabase
      .from('bicycle_inspections')
      .select('frame_cleaned_at, drivetrain_degreased_at')
      .eq('id', inspectionId)
      .maybeSingle();
    const cleaningDone =
      !!(current as any)?.frame_cleaned_at && !!(current as any)?.drivetrain_degreased_at;
    const nextStatus: InspectionStatus = cleaningDone ? 'repaired' : 'cleaning';

    const { data, error } = await supabase
      .from('bicycle_inspections')
      .update({ status: nextStatus })
      .eq('id', inspectionId)
      .select()
      .single();

    if (error) throw error;
    if (nextStatus === 'repaired') {
      await triggerReceiverAvailabilityIfDeferred(inspectionId);
    }
    return data as BicycleInspection;
  } catch (error) {
    console.error('Error moving to repaired:', error);
    throw error;
  }
};

// Admin manual status override — no side effects (no emails, no flags).
export const adminSetInspectionStatus = async (
  inspectionId: string,
  status: InspectionStatus
): Promise<void> => {
  const { error } = await supabase
    .from('bicycle_inspections')
    .update({ status })
    .eq('id', inspectionId);
  if (error) throw error;
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

// Check if all approved issues are ready (parts ordered AND arrived)
export const checkAllPartsArrived = (issues: InspectionIssue[]): boolean => {
  const approvedIssues = issues.filter(i => i.status === 'approved' || i.status === 'repaired' || i.status === 'resolved');
  if (approvedIssues.length === 0) return false;
  return approvedIssues.every(issue =>
    issue.status === 'repaired' || issue.status === 'resolved' ||
    (!!issue.parts_arrived && !!issue.parts_ordered)
  );
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

// Update fields on an existing inspection issue (admin/mechanic — used in pricing stage).
// When estimated_cost is provided, also stamps priced_* so the "all priced" gate still works.
export const updateInspectionIssue = async (
  issueId: string,
  fields: {
    issue_description?: string;
    estimated_cost?: number | null;
    parts_cost?: number | null;
    labour_cost?: number | null;
    part_name?: string | null;
    part_spec?: string | null;
    part_number?: string | null;
    repair_id?: string | null;
  },

  actorId?: string,
  actorName?: string
): Promise<InspectionIssue | null> => {
  try {
    const update: Record<string, any> = { ...fields };
    const priceChanged =
      Object.prototype.hasOwnProperty.call(fields, 'estimated_cost') ||
      Object.prototype.hasOwnProperty.call(fields, 'parts_cost') ||
      Object.prototype.hasOwnProperty.call(fields, 'labour_cost');
    if (priceChanged) {
      const hasPrice =
        (fields.estimated_cost != null) ||
        (fields.parts_cost != null) ||
        (fields.labour_cost != null);
      if (hasPrice) {
        update.priced_at = new Date().toISOString();
        if (actorId) update.priced_by_id = actorId;
        if (actorName) update.priced_by_name = actorName;
      } else {
        update.priced_at = null;
        update.priced_by_id = null;
        update.priced_by_name = null;
      }
    }

    const { data, error } = await supabase
      .from('inspection_issues')
      .update(update)
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error updating inspection issue:', error);
    throw error;
  }
};

// Delete an existing inspection issue (admin only per RLS).
export const deleteInspectionIssue = async (issueId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('inspection_issues')
      .delete()
      .eq('id', issueId);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting inspection issue:', error);
    throw error;
  }
};

// Insert a new issue against an existing inspection (used in pricing stage so we
// don't re-trigger the status reset that addInspectionIssue does).
export const addIssueToExistingInspection = async (
  inspectionId: string,
  orderId: string,
  issueDescription: string,
  estimatedCost: number | null,
  requestedById: string,
  requestedByName: string,
  partInfo?: { part_name?: string | null; part_spec?: string | null; part_number?: string | null },
  extra?: {
    repair_id?: string | null;
    parts_cost?: number | null;
    labour_cost?: number | null;
    /** Defaults to 'pending' (pricing-stage behaviour). */
    status?: IssueStatus;
    /** 'receiver' bills the repair to the order's receiver. */
    billing_party?: 'customer' | 'receiver';
  }
): Promise<InspectionIssue | null> => {
  try {
    const now = new Date().toISOString();
    const hasSplit = extra?.parts_cost != null || extra?.labour_cost != null;
    const hasAnyPrice = estimatedCost != null || hasSplit;
    const status: IssueStatus = extra?.status ?? ('pending' as IssueStatus);
    const billingParty = extra?.billing_party ?? 'customer';
    const receiverBilled = billingParty === 'receiver';
    const { data, error } = await supabase
      .from('inspection_issues')
      .insert({
        inspection_id: inspectionId,
        order_id: orderId,
        issue_description: issueDescription,
        estimated_cost: estimatedCost,
        parts_cost: extra?.parts_cost ?? null,
        labour_cost: extra?.labour_cost ?? null,
        repair_id: extra?.repair_id ?? null,
        requested_by_id: requestedById,
        requested_by_name: requestedByName,
        status,
        billing_party: billingParty,
        part_name: partInfo?.part_name || null,
        part_spec: partInfo?.part_spec || null,
        part_number: partInfo?.part_number || null,
        priced_at: hasAnyPrice ? now : null,
        priced_by_id: hasAnyPrice ? requestedById : null,
        priced_by_name: hasAnyPrice ? requestedByName : null,
        ...(status === 'approved'
          ? {
              customer_response: receiverBilled
                ? `Approved by receiver (added by ${requestedByName})`
                : `Approved (added by ${requestedByName})`,
              customer_responded_at: now,
            }
          : {}),
        ...(receiverBilled
          ? {
              receiver_approved_at: now,
              receiver_approved_source: 'staff',
              offered_to_receiver_at: now,
              offered_to_receiver_by_id: requestedById,
              offered_to_receiver_by_name: requestedByName,
            }
          : {}),
      } as any)
      .select()
      .single();
    if (error) throw error;
    return data as InspectionIssue;
  } catch (error) {
    console.error('Error adding issue to existing inspection:', error);
    throw error;
  }
};



export const createInspectionServiceInvoice = async (
  orderId: string
): Promise<{ invoiceNumber: string; invoiceId: string; invoiceUrl: string; totalAmount: number }> => {
  const { data, error } = await supabase.functions.invoke('create-inspection-service-invoice', {
    body: { orderId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export type CleaningTaskKey = 'frame' | 'drivetrain';

export const setInspectionCleaningTask = async (
  inspectionId: string,
  task: CleaningTaskKey,
  done: boolean,
  userId: string,
  userName: string
): Promise<BicycleInspection | null> => {
  const now = new Date().toISOString();
  const prefix = task === 'frame' ? 'frame_cleaned' : 'drivetrain_degreased';
  const patch: any = {
    [`${prefix}_at`]: done ? now : null,
    [`${prefix}_by_id`]: done ? userId : null,
    [`${prefix}_by_name`]: done ? userName : null,
  };
  const { data, error } = await supabase
    .from('bicycle_inspections')
    .update(patch)
    .eq('id', inspectionId)
    .select('*, inspection_issues(status)')
    .single();
  if (error) throw error;

  // Auto-promote from the internal 'cleaning' stage once both cleaning tasks
  // are done. Pick the terminal status based on whether there were any
  // approved issues (repaired) vs the no-issues path (inspected).
  const row: any = data;
  const bothClean = !!row?.frame_cleaned_at && !!row?.drivetrain_degreased_at;
  if (row?.status === 'cleaning' && bothClean) {
    const issues: any[] = row.inspection_issues || [];
    const hadApproved = issues.some((i) =>
      ['approved', 'resolved', 'repaired'].includes(i.status)
    );
    const finalStatus: InspectionStatus = hadApproved ? 'repaired' : 'inspected';
    const finalPatch: any = { status: finalStatus };
    if (!hadApproved) {
      const nowIso = new Date().toISOString();
      finalPatch.released_to_customer_at = nowIso;
      finalPatch.released_by_id = userId;
      finalPatch.released_by_name = userName;
    }
    const { data: promoted, error: pErr } = await supabase
      .from('bicycle_inspections')
      .update(finalPatch)
      .eq('id', inspectionId)
      .select()
      .single();
    if (pErr) throw pErr;
    await triggerReceiverAvailabilityIfDeferred(inspectionId);
    return promoted as BicycleInspection;
  }

  return data as BicycleInspection;
};

// ---------------------------------------------------------------------------
// Receiver repair offers
//
// When a customer (the seller/booker) declines recommended repairs, staff can
// offer the same work to the receiver, who pays for it directly. Approvals made
// this way are billed to the receiver (`billing_party = 'receiver'`).
// ---------------------------------------------------------------------------

export interface RepairOfferIssue {
  id: string;
  description: string;
  cost?: number;
}

export interface PublicRepairOffer {
  found: boolean;
  order_id?: string;
  tracking_number?: string | null;
  bike_brand?: string | null;
  bike_model?: string | null;
  receiver_name?: string | null;
  approved?: RepairOfferIssue[];
  offered?: RepairOfferIssue[];
  receiver_approved?: RepairOfferIssue[];
  responded_at?: string | null;
}

/** Emails/WhatsApps the receiver an offer for every declined repair on an order. */
export const offerDeclinedRepairsToReceiver = async (
  orderId: string
): Promise<{ offered: number; email?: string; whatsapp?: string; link?: string }> => {
  const { data, error } = await supabase.functions.invoke('send-repair-offer', {
    body: { orderId },
  });
  if (error) {
    let details = error.message;
    try {
      const ctx = (error as any)?.context;
      if (ctx?.text) details = await ctx.text();
    } catch {
      // keep the original message
    }
    throw new Error(details || 'Failed to send repair offer');
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Public (unauthenticated) read of the receiver's repair offer. */
export const fetchPublicRepairOffer = async (orderId: string): Promise<PublicRepairOffer> => {
  const { data, error } = await supabase.rpc('get_public_repair_offer', { p_order_id: orderId });
  if (error) throw error;
  return (data ?? { found: false }) as unknown as PublicRepairOffer;
};

/** Public (unauthenticated) submission of the receiver's chosen repairs. */
export const submitPublicRepairOffer = async (
  orderId: string,
  approvedIssueIds: string[]
): Promise<{ success: boolean; approved?: number; declined?: number; error?: string }> => {
  const { data, error } = await supabase.rpc('submit_public_repair_offer', {
    p_order_id: orderId,
    p_approved_issue_ids: approvedIssueIds,
  });
  if (error) throw error;
  return (data || { success: false }) as any;
};

/**
 * Admin/mechanic override: mark a declined issue as approved by the receiver
 * (rather than the customer) so the work can go ahead and be billed to them.
 */
export const markIssueReceiverApproved = async (
  issueId: string,
  userId: string,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('inspection_issues')
    .update({
      status: 'approved',
      billing_party: 'receiver',
      receiver_approved_at: now,
      receiver_approved_source: 'staff',
      receiver_declined_at: null,
      customer_response: `Approved by receiver (recorded by ${userName})`,
      customer_responded_at: now,
      offered_to_receiver_at: now,
      offered_to_receiver_by_id: userId,
      offered_to_receiver_by_name: userName,
      updated_at: now,
    })
    .eq('id', issueId);
  if (error) throw error;
};

/**
 * Creates a QuickBooks invoice for a receiver-billed repair issue.
 * The invoice is billed to the order's receiver (not the booking customer).
 */
export const createReceiverInspectionInvoice = async (
  issueId: string
): Promise<{ invoiceNumber: string; invoiceId: string; invoiceUrl: string; totalAmount: number; alreadyExists?: boolean }> => {
  const { data, error } = await supabase.functions.invoke('create-receiver-inspection-invoice', {
    body: { issueId },
  });
  if (error) {
    let details = error.message;
    try {
      const ctx = (error as any)?.context;
      if (ctx?.text) details = await ctx.text();
    } catch {
      // keep the original message
    }
    throw new Error(details || 'Failed to create receiver invoice');
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

/** Reverts a receiver approval back to a declined repair. */
export const undoIssueReceiverApproval = async (issueId: string): Promise<void> => {
  const { error } = await supabase
    .from('inspection_issues')
    .update({
      status: 'declined',

      billing_party: 'customer',
      receiver_approved_at: null,
      receiver_approved_source: null,
      customer_response: 'Declined',
      // Clear any invoice created for the receiver so it can be re-billed later if needed.
      invoice_number: null,
      invoice_id: null,
      invoice_url: null,
      invoiced_at: null,
      invoiced_by_id: null,
      invoiced_by_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', issueId);
  if (error) throw error;
};

/**
 * Staff reversal: move a declined issue back to approved, billed to the
 * booking customer as normal (clears any receiver-offer traces).
 */
export const reinstateDeclinedIssue = async (
  issueId: string,
  userId: string,
  userName: string
): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('inspection_issues')
    .update({
      status: 'approved' as IssueStatus,
      billing_party: 'customer',
      receiver_approved_at: null,
      receiver_approved_source: null,
      receiver_declined_at: null,
      customer_response: `Approved (decline reversed by ${userName})`,
      customer_responded_at: now,
      updated_at: now,
    })
    .eq('id', issueId);
  if (error) throw error;
  pushIssueStatusToInspectaBike(issueId);
};
