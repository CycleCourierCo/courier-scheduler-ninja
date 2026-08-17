import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { formatDistanceToNowStrict } from "date-fns";
import { Wrench, CheckCircle, XCircle, AlertTriangle, Loader2, RotateCcw, X, MapPin, FileText, ExternalLink, Clock, ArrowUpDown, PoundSterling, PackageCheck, Send, Search, Pencil, Trash2, Plus, Save, Truck } from "lucide-react";
import { getDriverAssignment } from "@/utils/driverAssignmentUtils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getPendingInspections,
  getMyInspections,
  markAsInspected,
  addInspectionIssue,
  submitCustomerResponse,
  resolveIssue,
  resetToPending,
  acceptIssue,
  declineIssue,
  markIssueRepaired,
  moveToRepaired,
  checkAllApprovedRepaired,
  reconcileInspectionStatuses,
  setIssuePrice,
  releaseInspectionToCustomer,
  markPartsArrived,
  unmarkPartsArrived,
  markPartsOrdered,
  unmarkPartsOrdered,
  updateInspectionIssue,
  deleteInspectionIssue,
  setIssueStatusAsAdmin,
  addIssueToExistingInspection,
  adminSetInspectionStatus,
  updateInspectionBikeType,
  setInspectionCleaningTask,
  markInvoiceNotNeeded,
  clearInvoiceSkip,
  offerDeclinedRepairsToReceiver,
  markIssueReceiverApproved,
  undoIssueReceiverApproval,
  reinstateDeclinedIssue,
  createReceiverInspectionInvoice,

} from "@/services/inspectionService";
import { InspectionIssue, InspectionStatus } from "@/types/inspection";
import { hasRole } from "@/lib/roles";
import { RepairPicker, type RepairPickerSelection } from "@/components/inspections/RepairPicker";
import { BikeCategoryPicker } from "@/components/inspections/BikeCategoryPicker";
import WorkshopScheduleTab from "@/components/inspections/WorkshopScheduleTab";
import { sendOrderToInspectaBike } from "@/services/inspectabikeService";
import BillingCustomerDialog, { type QuickBooksCustomerOption } from "@/components/inspections/BillingCustomerDialog";
import InspectionFilters, {
  EMPTY_INSPECTION_FILTERS,
  type InspectionFilterState,
} from "@/components/inspections/InspectionFilters";

// (workshop settings/labour pricing consumed inside RepairPicker)


interface IssueEntry {
  description: string;
  estimatedCost: string;
  partsCost: string;
  labourCost: string;
  partName: string;
  partSpec: string;
  partNumber: string;
  repairId: string | null;
}

interface ChecklistIssue extends IssueEntry {}

// Standard inspection checklist items
const INSPECTION_ITEMS = [
  { id: 'brakes_gears', label: 'Brake and gear tuning' },
  { id: 'safety_inspection', label: 'Full safety inspection (frame, wheels, drivetrain, tyres)' },
  { id: 'tyre_pressure', label: 'Tyre pressure check and adjustment' },
  { id: 'cleaning_bolts', label: 'Light cleaning and bolt tightening' },
];

const EMPTY_ISSUE: IssueEntry = {
  description: "", estimatedCost: "", partsCost: "", labourCost: "",
  partName: "", partSpec: "", partNumber: "", repairId: null,
};


const BicycleInspections = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasRole(userProfile, "admin");
  const isMechanic = hasRole(userProfile, "mechanic");
  const canManageInspections = isAdmin || isMechanic;

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [skipInvoiceDialog, setSkipInvoiceDialog] = useState<{
    open: boolean;
    inspectionId: string | null;
    reason: string;
  }>({ open: false, inspectionId: null, reason: "" });
  const [billingDialogState, setBillingDialogState] = useState<{
    open: boolean;
    inspectionId: string | null;
    suggestions: QuickBooksCustomerOption[];
    triedEmails: string[];
  }>({ open: false, inspectionId: null, suggestions: [], triedEmails: [] });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [issueCount, setIssueCount] = useState(1);
  const [issues, setIssues] = useState<IssueEntry[]>([{ ...EMPTY_ISSUE }]);
  // Per-issue price input for the awaiting-pricing stage
  const [priceInputs, setPriceInputs] = useState<Record<string, { parts: string; labour: string }>>({});
  // Edit-mode state for issues during awaiting_pricing
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  // Per-issue admin edit-mode toggle so admins don't see editable controls by default
  const [adminEditingIssueIds, setAdminEditingIssueIds] = useState<Set<string>>(new Set());
  const [editIssueDraft, setEditIssueDraft] = useState<{ description: string; partsCost: string; labourCost: string; partName: string; partSpec: string; partNumber: string; repairId: string | null }>({ description: "", partsCost: "", labourCost: "", partName: "", partSpec: "", partNumber: "", repairId: null });
  // Add-issue inline form state, keyed by inspection id
  const [addIssueForInspectionId, setAddIssueForInspectionId] = useState<string | null>(null);
  const [newIssueDraft, setNewIssueDraft] = useState<{ description: string; cost: string; partsCost: string; labourCost: string; partName: string; partSpec: string; partNumber: string; repairId: string | null; payer: "customer" | "receiver" }>({ description: "", cost: "", partsCost: "", labourCost: "", partName: "", partSpec: "", partNumber: "", repairId: null, payer: "customer" });

  const [customerResponses, setCustomerResponses] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<"oldest_collected" | "newest_collected" | "tracking_asc">("oldest_collected");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<InspectionFilterState>({ ...EMPTY_INSPECTION_FILTERS });

  
  // Inspection checklist dialog state
  const [inspectionChecklistOpen, setInspectionChecklistOpen] = useState(false);
  const [selectedOrderForInspection, setSelectedOrderForInspection] = useState<string | null>(null);
  const [inspectionChecklist, setInspectionChecklist] = useState<Record<string, boolean>>({});
  const [inspectionComments, setInspectionComments] = useState<Record<string, string>>({});
  const [checklistIssues, setChecklistIssues] = useState<Record<string, ChecklistIssue[]>>({});
  const [checklistBikeType, setChecklistBikeType] = useState<string | null>(null);
  // Workshop settings are consumed inside RepairPicker for live labour pricing.


  // Fetch inspections based on role
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["bicycle-inspections", canManageInspections, user?.id],
    queryFn: async () => {
      if (canManageInspections) {
        // Reconcile any stuck inspections before fetching
        await reconcileInspectionStatuses();
        return getPendingInspections();
      } else if (user?.id) {
        return getMyInspections(user.id);
      }
      return [];
    },
    enabled: !!user,
  });

  // Mark as inspected mutation
  const markInspectedMutation = useMutation({
    mutationFn: async ({ orderId, notes }: { orderId: string; notes?: string }) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }
      return markAsInspected(orderId, user.id, userProfile.name || user.email || "Admin", notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Bike marked as inspected (no issues)");
    },
    onError: (error) => {
      toast.error("Failed to mark as inspected");
      console.error(error);
    },
  });

  // Add multiple issues mutation
  const addMultipleIssuesMutation = useMutation({
    mutationFn: async ({ orderId, issues, bikeType }: { orderId: string; issues: IssueEntry[]; bikeType?: string | null }) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }

      const results = [];
      for (const issue of issues) {
        if (issue.description.trim()) {
          const parts = issue.partsCost.trim() ? parseFloat(issue.partsCost) : null;
          const labour = issue.labourCost.trim() ? parseFloat(issue.labourCost) : null;
          const fallback = issue.estimatedCost.trim() ? parseFloat(issue.estimatedCost) : null;
          const estimated = parts != null || labour != null
            ? (parts ?? 0) + (labour ?? 0)
            : fallback;
          const result = await addInspectionIssue(
            orderId,
            issue.description,
            estimated,
            user.id,
            userProfile.name || user.email || "Admin",
            {
              part_name: issue.partName?.trim() || null,
              part_spec: issue.partSpec?.trim() || null,
              part_number: issue.partNumber?.trim() || null,
            },
            {
              bike_type: bikeType ?? null,
              repair_id: issue.repairId,
              parts_cost: parts,
              labour_cost: labour,
            }
          );
          results.push(result);
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setIssueDialogOpen(false);
      resetIssueForm();
      toast.success("Issues recorded — awaiting admin pricing");
    },
    onError: (error) => {
      toast.error("Failed to report issues");
      console.error(error);
    },
  });


  // Set price on a single issue (admin pricing stage)
  const setPriceMutation = useMutation({
    mutationFn: async ({ issueId, partsCost, labourCost }: { issueId: string; partsCost: number; labourCost: number }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return setIssuePrice(issueId, partsCost, labourCost, user.id, userProfile?.name || user.email || "Admin");
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setPriceInputs(prev => {
        const next = { ...prev };
        delete next[vars.issueId];
        return next;
      });
      toast.success("Price saved");
    },
    onError: (error) => {
      toast.error("Failed to save price");
      console.error(error);
    },
  });

  // Update an existing issue (admin/mechanic during pricing)
  const updateIssueMutation = useMutation({
    mutationFn: async ({ issueId, fields }: { issueId: string; fields: Parameters<typeof updateInspectionIssue>[1] }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return updateInspectionIssue(issueId, fields, user.id, userProfile?.name || user.email || "Admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setEditingIssueId(null);
      toast.success("Issue updated");
    },
    onError: (error) => {
      toast.error("Failed to update issue");
      console.error(error);
    },
  });

  // Delete an issue (admin only)
  const deleteIssueMutation = useMutation({
    mutationFn: async (issueId: string) => deleteInspectionIssue(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Issue removed");
    },
    onError: (error) => {
      toast.error("Failed to remove issue");
      console.error(error);
    },
  });

  // Admin override of an individual issue's status
  const overrideIssueStatusMutation = useMutation({
    mutationFn: async ({ issueId, status }: { issueId: string; status: "pending" | "approved" | "declined" }) =>
      setIssueStatusAsAdmin(issueId, status, userProfile?.name || user?.email || "Admin"),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success(
        vars.status === "pending" ? "Issue reset to pending" : `Issue marked ${vars.status}`
      );
    },
    onError: (error) => {
      toast.error("Failed to update issue status");
      console.error(error);
    },
  });

  // Add a new issue to an existing inspection (pricing stage)
  const addIssueAtPricingMutation = useMutation({
    mutationFn: async ({ inspectionId, orderId, draft, postApproval }: { inspectionId: string; orderId: string; draft: typeof newIssueDraft; postApproval?: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated");
      const parts = draft.partsCost.trim() ? parseFloat(draft.partsCost) : null;
      const labour = draft.labourCost.trim() ? parseFloat(draft.labourCost) : null;
      const fallback = draft.cost.trim() ? parseFloat(draft.cost) : null;
      const estimated = parts != null || labour != null
        ? (parts ?? 0) + (labour ?? 0)
        : fallback;
      const billsReceiver = !!postApproval && draft.payer === "receiver";
      const issue = await addIssueToExistingInspection(
        inspectionId,
        orderId,
        draft.description.trim(),
        estimated,
        user.id,
        userProfile?.name || user.email || "Admin",
        {
          part_name: draft.partName.trim() || null,
          part_spec: draft.partSpec.trim() || null,
          part_number: draft.partNumber.trim() || null,
        },
        {
          repair_id: draft.repairId,
          parts_cost: parts,
          labour_cost: labour,
          ...(postApproval ? { status: "approved" as const } : {}),
          billing_party: billsReceiver ? ("receiver" as const) : ("customer" as const),
        }
      );

      if (billsReceiver && issue?.id) {
        try {
          const invoice = await createReceiverInspectionInvoice(issue.id);
          return { issue, invoice, invoiceError: null as string | null };
        } catch (invoiceError: any) {
          return { issue, invoice: null, invoiceError: invoiceError?.message || "Invoice could not be created" };
        }
      }
      return { issue, invoice: null, invoiceError: null as string | null };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setAddIssueForInspectionId(null);
      setNewIssueDraft({ description: "", cost: "", partsCost: "", labourCost: "", partName: "", partSpec: "", partNumber: "", repairId: null, payer: "customer" });
      if (result?.invoice) {
        const already = result.invoice.alreadyExists ? " (already existed)" : "";
        toast.success(`Issue added and receiver invoice #${result.invoice.invoiceNumber} created${already}`, {
          action: result.invoice.invoiceUrl
            ? { label: "Open", onClick: () => window.open(result.invoice.invoiceUrl, "_blank") }
            : undefined,
        });
      } else {
        toast.success("Issue added");
        if (result?.invoiceError) {
          toast.warning(`Invoice not created: ${result.invoiceError}`);
        }
      }
    },
    onError: (error) => {
      toast.error("Failed to add issue");
      console.error(error);
    },
  });


  // Update bike category on an inspection
  const updateBikeTypeMutation = useMutation({
    mutationFn: async ({ inspectionId, bikeType }: { inspectionId: string; bikeType: string }) =>
      updateInspectionBikeType(inspectionId, bikeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Bike category updated");
    },
    onError: (error) => {
      toast.error("Failed to update bike category");
      console.error(error);
    },
  });

  // InspectaBike: push a bike to the external inspection app
  const [sendingInspectaBikeOrderId, setSendingInspectaBikeOrderId] = useState<string | null>(null);
  const sendToInspectaBikeMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      setSendingInspectaBikeOrderId(orderId);
      return sendOrderToInspectaBike(orderId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success(result?.already_linked ? "Already linked to InspectaBike" : "Sent to InspectaBike");
      if (result?.report_url) window.open(result.report_url, "_blank", "noopener");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to send to InspectaBike");
      console.error(error);
    },
    onSettled: () => setSendingInspectaBikeOrderId(null),
  });





  // Release inspection to customer (admin gate)
  const releaseMutation = useMutation({
    mutationFn: async (inspectionId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      return releaseInspectionToCustomer(
        inspectionId,
        user.id,
        userProfile?.name || user.email || "Admin"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Inspection released to customer");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to release inspection");
      console.error(error);
    },
  });

  // Toggle parts arrived (mechanic/admin)
  const togglePartsArrivedMutation = useMutation({
    mutationFn: async ({ issueId, arrived }: { issueId: string; arrived: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (arrived) {
        return markPartsArrived(issueId, user.id, userProfile?.name || user.email || "Mechanic");
      }
      return unmarkPartsArrived(issueId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
    },
    onError: (error) => {
      toast.error("Failed to update parts status");
      console.error(error);
    },
  });

  // Toggle parts ordered (mechanic/admin)
  const togglePartsOrderedMutation = useMutation({
    mutationFn: async ({ issueId, ordered }: { issueId: string; ordered: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (ordered) {
        return markPartsOrdered(issueId, user.id, userProfile?.name || user.email || "Mechanic");
      }
      return unmarkPartsOrdered(issueId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
    },
    onError: (error) => {
      toast.error("Failed to update parts ordered status");
      console.error(error);
    },
  });

  // Accept issue mutation
  const acceptIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      return acceptIssue(issueId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Issue accepted");
    },
    onError: (error) => {
      toast.error("Failed to accept issue");
      console.error(error);
    },
  });

  // Decline issue mutation
  const declineIssueMutation = useMutation({
    mutationFn: async ({ issueId, reason }: { issueId: string; reason?: string }) => {
      return declineIssue(issueId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setCustomerResponses({});
      toast.success("Issue declined");
    },
    onError: (error) => {
      toast.error("Failed to decline issue");
      console.error(error);
    },
  });

  // Submit customer response mutation
  const submitResponseMutation = useMutation({
    mutationFn: async ({ issueId, response }: { issueId: string; response: string }) => {
      return submitCustomerResponse(issueId, response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setCustomerResponses({});
      toast.success("Response submitted");
    },
    onError: (error) => {
      toast.error("Failed to submit response");
      console.error(error);
    },
  });

  // Resolve issue mutation
  const resolveIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }
      return resolveIssue(issueId, user.id, userProfile.name || user.email || "Admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Issue resolved");
    },
    onError: (error) => {
      toast.error("Failed to resolve issue");
      console.error(error);
    },
  });

  // Mark issue as repaired mutation
  const markRepairedMutation = useMutation({
    mutationFn: async (issueId: string) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }
      return markIssueRepaired(issueId, user.id, userProfile.name || user.email || "Admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Issue marked as repaired");
    },
    onError: (error) => {
      toast.error("Failed to mark as repaired");
      console.error(error);
    },
  });

  // Offer declined repairs to the receiver (they pay directly)
  const offerToReceiverMutation = useMutation({
    mutationFn: async (orderId: string) => offerDeclinedRepairsToReceiver(orderId),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      if (result?.skipped === "test_account") {
        toast.success("Offer recorded (test account — no message sent)");
      } else {
        toast.success(`Offer sent to the receiver for ${result?.offered ?? 0} repair(s)`);
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to send the repair offer");
      console.error(error);
    },
  });

  // Admin/mechanic override: receiver approved this repair (not the customer)
  const receiverApproveMutation = useMutation({
    mutationFn: async (issueId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      await markIssueReceiverApproved(issueId, user.id, userProfile?.name || user.email || "Admin");
      try {
        const invoice = await createReceiverInspectionInvoice(issueId);
        return { invoice, invoiceError: null };
      } catch (invoiceError: any) {
        return { invoice: null, invoiceError: invoiceError?.message || "Invoice could not be created" };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      if (result?.invoice) {
        const already = result.invoice.alreadyExists ? " (already existed)" : "";
        toast.success(`Repair approved by receiver and invoice #${result.invoice.invoiceNumber} created${already}`, {
          action: result.invoice.invoiceUrl
            ? { label: "Open", onClick: () => window.open(result.invoice.invoiceUrl, "_blank") }
            : undefined,
        });
      } else {
        toast.success("Marked as approved by the receiver");
        if (result?.invoiceError) {
          toast.warning(`Invoice not created: ${result.invoiceError}`);
        }
      }
    },
    onError: (error) => {
      toast.error("Failed to record the receiver's approval");
      console.error(error);
    },
  });

  const undoReceiverApprovalMutation = useMutation({
    mutationFn: async (issueId: string) => undoIssueReceiverApproval(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Receiver approval removed");
    },
    onError: (error) => {
      toast.error("Failed to remove the receiver approval");
      console.error(error);
    },
  });

  // Staff reversal: declined -> approved (customer pays as normal)
  const reinstateIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      if (!user?.id) throw new Error("User not authenticated");
      return reinstateDeclinedIssue(issueId, user.id, userProfile?.name || user.email || "Admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Issue moved back to approved");
    },
    onError: (error) => {
      toast.error("Failed to move the issue back to approved");
      console.error(error);
    },
  });




  // Cleaning task mutation (frame cleaned / drivetrain degreased)
  const cleaningMutation = useMutation({
    mutationFn: async (args: { inspectionId: string; task: 'frame' | 'drivetrain'; done: boolean }) => {
      if (!user?.id) throw new Error("Not authenticated");
      return setInspectionCleaningTask(
        args.inspectionId,
        args.task,
        args.done,
        user.id,
        userProfile?.name || user.email || "Mechanic"
      );
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success(vars.done ? "Marked as done" : "Cleared");
    },
    onError: (err) => {
      toast.error("Failed to update cleaning task");
      console.error(err);
    },
  });

  // Complete repairs mutation (move to repaired status)
  const completeRepairsMutation = useMutation({
    mutationFn: async (inspectionId: string) => {
      return moveToRepaired(inspectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Repairs completed");
    },
    onError: (error) => {
      toast.error("Failed to complete repairs");
      console.error(error);
    },
  });

  // Reset to pending mutation
  const resetToPendingMutation = useMutation({
    mutationFn: async (inspectionId: string) => {
      return resetToPending(inspectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Bike moved back to awaiting inspection");
    },
    onError: (error) => {
      toast.error("Failed to reset inspection status");
      console.error(error);
    },
  });

  // Admin manual status override
  const adminSetStatusMutation = useMutation({
    mutationFn: async ({ inspectionId, status }: { inspectionId: string; status: InspectionStatus }) => {
      return adminSetInspectionStatus(inspectionId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Inspection status updated");
    },
    onError: (error) => {
      toast.error("Failed to update inspection status");
      console.error(error);
    },
  });



  // Create inspection invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (vars: {
      inspectionId: string;
      quickbooksCustomerId?: string;
      billingEmailOverride?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-inspection-invoice', {
        body: vars,
      });
      if (error) {
        // Non-2xx: read the structured payload so we can react to a failed match.
        let payload: any = null;
        try {
          payload = await (error as any)?.context?.json?.();
        } catch {
          payload = null;
        }
        if (payload?.error === 'customer_not_matched') {
          const err: any = new Error(payload.message || 'Choose the billing customer to continue.');
          err.customerNotMatched = payload;
          throw err;
        }
        throw new Error(payload?.message || payload?.error || error.message || 'Failed to create invoice');
      }
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setBillingDialogState({ open: false, inspectionId: null, suggestions: [], triedEmails: [] });
      toast.success(`Invoice ${data.invoiceNumber} created successfully`);
    },
    onError: (error: any, vars) => {
      if (error?.customerNotMatched) {
        setBillingDialogState({
          open: true,
          inspectionId: vars.inspectionId,
          suggestions: error.customerNotMatched.suggestions || [],
          triedEmails: error.customerNotMatched.triedEmails || [],
        });
        toast.info(error.message);
        return;
      }
      toast.error(error.message || "Failed to create invoice");
      console.error(error);
    },
  });

  // Mark a job as deliberately not invoiced
  const skipInvoiceMutation = useMutation({
    mutationFn: async (vars: { inspectionId: string; reason: string }) =>
      markInvoiceNotNeeded(vars.inspectionId, vars.reason, {
        id: user?.id,
        name: (userProfile as any)?.name || user?.email || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setSkipInvoiceDialog({ open: false, inspectionId: null, reason: "" });
      toast.success("Marked as no invoice needed");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update invoicing status");
    },
  });

  const clearSkipMutation = useMutation({
    mutationFn: async (inspectionId: string) => clearInvoiceSkip(inspectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Job is invoiceable again");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update invoicing status");
    },
  });




  const handleOpenIssueDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIssueDialogOpen(true);
  };

  // Inspection checklist handlers
  const handleOpenInspectionChecklist = (orderId: string) => {
    setSelectedOrderForInspection(orderId);
    setInspectionChecklist({});
    setInspectionComments({});
    setChecklistIssues({});
    // Prefill bike category from any existing inspection, else leave blank so
    // the mechanic classifies it before pricing/labour lookup.
    const order = (inspections as any[]).find((o) => o.id === orderId);
    const existing = order?.inspection?.bike_type as string | null | undefined;
    setChecklistBikeType(existing ?? null);
    setInspectionChecklistOpen(true);
  };


  const handleChecklistItemToggle = (itemId: string) => {
    setInspectionChecklist(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleChecklistCommentChange = (itemId: string, comment: string) => {
    setInspectionComments(prev => ({
      ...prev,
      [itemId]: comment
    }));
  };

  const handleAddChecklistIssue = (itemId: string) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { ...EMPTY_ISSUE }]
    }));
  };

  const handleRemoveChecklistIssue = (itemId: string, index: number) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter((_, i) => i !== index)
    }));
  };

  const handleUpdateChecklistIssue = (itemId: string, index: number, field: 'description' | 'estimatedCost' | 'partsCost' | 'labourCost' | 'partName' | 'partSpec' | 'partNumber', value: string) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((issue, i) =>
        i === index ? { ...issue, [field]: value } : issue
      )
    }));
  };

  const patchChecklistIssue = (itemId: string, index: number, patch: Partial<ChecklistIssue>) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((issue, i) =>
        i === index ? { ...issue, ...patch } : issue
      )
    }));
  };


  const allItemsChecked = INSPECTION_ITEMS.every(
    item => inspectionChecklist[item.id]
  );

  // Collect all issues across all checklist items
  const allChecklistIssues: IssueEntry[] = Object.entries(checklistIssues).flatMap(([itemId, issues]) => {
    const itemLabel = INSPECTION_ITEMS.find(i => i.id === itemId)?.label || itemId;
    return issues
      .filter(issue => issue.description.trim())
      .map(issue => ({
        ...issue,
        description: `[${itemLabel}] ${issue.description}`,
      }));
  });


  const hasIssues = allChecklistIssues.length > 0;

  const handleConfirmInspection = async () => {
    if (!selectedOrderForInspection || !allItemsChecked) return;

    if (hasIssues) {
      if (!checklistBikeType) {
        toast.error("Choose the bike category before reporting issues");
        return;
      }
      addMultipleIssuesMutation.mutate({
        orderId: selectedOrderForInspection,
        issues: allChecklistIssues,
        bikeType: checklistBikeType,
      });
      setInspectionChecklistOpen(false);
    } else {
      // No issues - mark as inspected
      const notes = INSPECTION_ITEMS.map(item => {
        const comment = inspectionComments[item.id];
        return comment
          ? `✓ ${item.label}: ${comment}`
          : `✓ ${item.label}`;
      }).join('\n');

      markInspectedMutation.mutate({ orderId: selectedOrderForInspection, notes });
      setInspectionChecklistOpen(false);
    }
  };


  const handleIssueCountChange = (count: string) => {
    const newCount = parseInt(count);
    setIssueCount(newCount);

    setIssues(prev => {
      if (newCount > prev.length) {
        return [...prev, ...Array(newCount - prev.length).fill(null).map(() => ({ ...EMPTY_ISSUE }))];
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  const updateIssue = (index: number, field: keyof IssueEntry, value: string) => {
    setIssues(prev => prev.map((issue, i) =>
      i === index ? { ...issue, [field]: value } : issue
    ));
  };

  const resetIssueForm = () => {
    setIssueCount(1);
    setIssues([{ ...EMPTY_ISSUE }]);
    setSelectedOrderId(null);
  };

  const handleSubmitIssues = () => {
    if (!selectedOrderId) {
      toast.error("No order selected");
      return;
    }
    
    const validIssues = issues.filter(issue => issue.description.trim());
    if (validIssues.length === 0) {
      toast.error("Please provide at least one issue description");
      return;
    }
    
    addMultipleIssuesMutation.mutate({ orderId: selectedOrderId, issues: validIssues });
  };

  const getIssueBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "success";
      case "declined":
        return "destructive";
      case "resolved":
      case "repaired":
        return "success";
      default:
        return "warning";
    }
  };

  const getInspectionBadge = (status: string | undefined) => {
    switch (status) {
      case "inspected":
        return { variant: "success" as const, label: "No Issues" };
      case "awaiting_pricing":
        return { variant: "warning" as const, label: "Awaiting Pricing" };
      case "issues_found":
        return { variant: "destructive" as const, label: "Issues Found" };
      case "awaiting_parts":
        return { variant: "warning" as const, label: "Awaiting Parts" };
      case "awaiting_repair":
      case "in_repair":
        return { variant: "warning" as const, label: "Awaiting Repair" };
      case "cleaning":
        return { variant: "warning" as const, label: "Cleaning" };
      case "repaired":
        return { variant: "success" as const, label: "Repaired" };
      default:
        return { variant: "secondary" as const, label: "Awaiting Inspection" };
    }
  };

  // Sort inspections (admin/mechanic only - customers always see newest first by default query)
  const sortedInspections = useMemo(() => {
    if (!canManageInspections) return inspections;
    const arr = [...inspections];
    arr.sort((a: any, b: any) => {
      if (sortBy === "tracking_asc") {
        return (a.tracking_number || "").localeCompare(b.tracking_number || "");
      }
      // Use collection_confirmation_sent_at if available, fallback to created_at
      const aTime = new Date(a.collection_confirmation_sent_at || a.created_at || 0).getTime();
      const bTime = new Date(b.collection_confirmation_sent_at || b.created_at || 0).getTime();
      return sortBy === "oldest_collected" ? aTime - bTime : bTime - aTime;
    });
    return arr;
  }, [inspections, sortBy, canManageInspections]);

  // Reference date used by the date filter: collection date, falling back to created date
  const getRefDate = (o: any) =>
    o.collection_confirmation_sent_at || o.pickup_date || o.created_at || null;
  const getRepairerNames = (o: any): string[] =>
    (o.issues || [])
      .filter((iss: any) => iss.status === "repaired" && iss.resolved_by_name)
      .map((iss: any) => iss.resolved_by_name as string);

  // Billing settlement: invoiced, manually skipped, or nothing to invoice
  // (released inspection with no issues, or all repairs declined).
  const getSettledReason = (
    i: any
  ):
    | "invoiced"
    | "skipped"
    | "no_issues"
    | "declined"
    | "zero_value"
    | "receiver_billed"
    | null => {
    const inspection = i.inspection;
    if (inspection?.invoice_number) return "invoiced";
    if (inspection?.invoice_skipped_at) return "skipped";
    const released = inspection?.status === "inspected" || inspection?.status === "repaired";
    if (!released) return null;
    const issues = i.issues || [];
    if (issues.length === 0) return "no_issues";
    const notDeclined = issues.filter(
      (iss: any) => iss.status !== "declined" && iss.status !== "cancelled"
    );
    if (notDeclined.length === 0) return "declined";
    // Receiver-billed work is invoiced to the receiver, not the booking customer
    const billable = notDeclined.filter((iss: any) => iss.billing_party !== "receiver");
    if (billable.length === 0) return "receiver_billed";
    if (i.repairs_declined_at) return "declined";
    const total = billable.reduce((sum: number, iss: any) => {
      const parts = Number(iss.parts_cost ?? 0) || 0;
      const labour = Number(iss.labour_cost ?? 0) || 0;
      const split = parts + labour;
      const value = split > 0 ? split : Number(iss.estimated_cost ?? 0) || 0;
      return sum + value;
    }, 0);
    if (Math.round(total * 100) === 0) return "zero_value";
    return null;
  };


  const isBillingSettled = (i: any) => getSettledReason(i) !== null;

  const filterOptions = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      Array.from(new Set(arr.filter((v): v is string => !!v && v.trim().length > 0))).sort((a, b) =>
        a.localeCompare(b)
      );
    return {
      customers: uniq(inspections.map((o: any) => o.booking_customer_name)),
      inspectors: uniq(inspections.map((o: any) => o.inspection?.inspected_by_name)),
      repairers: uniq(inspections.flatMap((o: any) => getRepairerNames(o))),
      bikeTypes: uniq(inspections.map((o: any) => o.inspection?.bike_type)),
    };
  }, [inspections]);

  // Apply free-text search plus the filter bar selections
  const filteredInspections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    const now = new Date();
    if (filters.datePreset === "7d") {
      fromDate = new Date(now.getTime() - 7 * 86400000);
    } else if (filters.datePreset === "30d") {
      fromDate = new Date(now.getTime() - 30 * 86400000);
    } else if (filters.datePreset === "month") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filters.datePreset === "custom") {
      if (filters.from) fromDate = new Date(new Date(filters.from).setHours(0, 0, 0, 0));
      if (filters.to) toDate = new Date(new Date(filters.to).setHours(23, 59, 59, 999));
    }

    let bookedFromDate: Date | null = null;
    let bookedToDate: Date | null = null;
    if (filters.bookedPreset === "7d") {
      bookedFromDate = new Date(now.getTime() - 7 * 86400000);
    } else if (filters.bookedPreset === "30d") {
      bookedFromDate = new Date(now.getTime() - 30 * 86400000);
    } else if (filters.bookedPreset === "month") {
      bookedFromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filters.bookedPreset === "custom") {
      if (filters.bookedFrom) bookedFromDate = new Date(new Date(filters.bookedFrom).setHours(0, 0, 0, 0));
      if (filters.bookedTo) bookedToDate = new Date(new Date(filters.bookedTo).setHours(23, 59, 59, 999));
    }

    return sortedInspections.filter((o: any) => {
      if (q) {
        const haystack = [
          o.tracking_number,
          o.customer_order_number,
          o.bike_brand,
          o.bike_model,
          (o.sender as any)?.name,
          (o.receiver as any)?.name,
          o.booking_customer_name,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (fromDate || toDate) {
        const ref = getRefDate(o);
        if (!ref) return false;
        const t = new Date(ref).getTime();
        if (fromDate && t < fromDate.getTime()) return false;
        if (toDate && t > toDate.getTime()) return false;
      }

      if (bookedFromDate || bookedToDate) {
        if (!o.created_at) return false;
        const t = new Date(o.created_at).getTime();
        if (bookedFromDate && t < bookedFromDate.getTime()) return false;
        if (bookedToDate && t > bookedToDate.getTime()) return false;
      }


      if (filters.customer !== "all" && o.booking_customer_name !== filters.customer) return false;
      if (filters.inspector !== "all" && o.inspection?.inspected_by_name !== filters.inspector) return false;
      if (filters.repairer !== "all" && !getRepairerNames(o).includes(filters.repairer)) return false;
      if (filters.bikeType !== "all" && o.inspection?.bike_type !== filters.bikeType) return false;

      if (filters.billing !== "all") {
        const invoiced = !!o.inspection?.invoice_number;
        const skipped = !!o.inspection?.invoice_skipped_at;
        if (filters.billing === "invoiced" && !invoiced) return false;
        if (filters.billing === "skipped" && !skipped) return false;
        if (filters.billing === "unsettled" && isBillingSettled(o)) return false;
      }

      return true;
    });
  }, [sortedInspections, searchQuery, filters]);


  // Filter inspections by status
  const awaitingBase = filteredInspections.filter((i: any) => !i.inspection || i.inspection.status === "pending");
  const awaitingInspection = awaitingBase.filter((i: any) => !i.collection_confirmation_sent_at);
  const collected = awaitingBase.filter((i: any) => !!i.collection_confirmation_sent_at);
  const awaitingPricing = filteredInspections.filter((i: any) => i.inspection?.status === "awaiting_pricing");
  const withIssues = filteredInspections.filter((i: any) => i.inspection?.status === "issues_found");
  const awaitingParts = filteredInspections.filter((i: any) => i.inspection?.status === "awaiting_parts");
  const awaitingRepair = filteredInspections.filter((i: any) => i.inspection?.status === "awaiting_repair" || i.inspection?.status === "in_repair" || i.inspection?.status === "cleaning");
  const inspectedAndServiced = filteredInspections.filter(
    (i: any) =>
      (i.inspection?.status === "inspected" || i.inspection?.status === "repaired") &&
      !isBillingSettled(i)
  );
  const invoicedList = filteredInspections.filter(isBillingSettled);

  const renderInspectionCard = (order: any) => {
    const inspection = order.inspection;
    const orderIssues = order.issues || [];
    const pendingIssues = orderIssues.filter((issue: InspectionIssue) => issue.status === "pending");
    const approvedIssues = orderIssues.filter((issue: InspectionIssue) => issue.status === "approved" || issue.status === "repaired");
    const isOwner = order.user_id === user?.id;
    const badgeConfig = getInspectionBadge(inspection?.status);
    const allApprovedRepaired = checkAllApprovedRepaired(orderIssues);
    const hasInvoice = !!inspection?.invoice_number;
    const invoiceSkipped = !!inspection?.invoice_skipped_at;
    // Receiver-billed repairs are invoiced to the receiver, so exclude them
    // from the booking customer's inspection invoice totals.
    const customerApprovedIssues = approvedIssues.filter(
      (i: any) => i.billing_party !== "receiver"
    );
    const receiverBilledTotal = approvedIssues
      .filter((i: any) => i.billing_party === "receiver")
      .reduce((sum: number, i: InspectionIssue) => sum + (Number(i.estimated_cost) || 0), 0);
    const totalForInvoice = customerApprovedIssues.reduce((sum: number, i: InspectionIssue) => sum + (Number(i.estimated_cost) || 0), 0);
    const canCreateInvoice = isAdmin && (inspection?.status === "repaired" || inspection?.status === "inspected") && customerApprovedIssues.length > 0 && !hasInvoice && !invoiceSkipped && totalForInvoice > 0;
    const isAwaitingPricing = inspection?.status === "awaiting_pricing";
    const isAwaitingParts = inspection?.status === "awaiting_parts";
    const isAwaitingRepair = inspection?.status === "awaiting_repair" || inspection?.status === "in_repair" || inspection?.status === "cleaning";
    // Post-approval stages: extra work found after the customer approved repairs.
    const isPostApproval = ["awaiting_parts", "awaiting_repair", "in_repair", "cleaning", "repaired"].includes(
      inspection?.status ?? ""
    );

    const allPriced = orderIssues.length > 0 && orderIssues.every((i: InspectionIssue) => i.estimated_cost != null);
    const approvedCount = approvedIssues.length;
    const declinedCount = orderIssues.filter((i: InspectionIssue) => i.status === "declined").length;
    const totalRepairCost = customerApprovedIssues.reduce((sum: number, i: InspectionIssue) => sum + (Number(i.estimated_cost) || 0), 0);
    // Declined repairs that can still be offered to the receiver (they pay directly)
    const offerableIssues = orderIssues.filter(
      (i: any) => i.status === "declined" && !i.receiver_declined_at
    );
    const offerableTotal = offerableIssues.reduce(
      (sum: number, i: InspectionIssue) => sum + (Number(i.estimated_cost) || 0),
      0
    );
    const receiverApprovedCount = orderIssues.filter(
      (i: any) => i.billing_party === "receiver"
    ).length;
    const lastOfferedAt = orderIssues.reduce(
      (latest: string | null, i: any) =>
        i.offered_to_receiver_at && (!latest || i.offered_to_receiver_at > latest)
          ? i.offered_to_receiver_at
          : latest,
      null as string | null
    );
    const partsArrivedCount = approvedIssues.filter((i: InspectionIssue) => (i.parts_arrived && i.parts_ordered) || i.status === 'repaired' || i.status === 'resolved').length;


    return (
      <Card key={order.id} className="mb-4 overflow-hidden">
        <CardHeader className="pb-3 p-4 sm:p-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex min-w-0 flex-wrap items-start gap-2 text-base sm:text-lg break-words">
                <Wrench className="h-5 w-5 shrink-0" />
                <span className="min-w-0 break-words">{order.bike_brand} {order.bike_model}</span>
                {order.bike_quantity > 1 && (
                  <Badge variant="secondary" className="shrink-0">x{order.bike_quantity}</Badge>
                )}
              </CardTitle>
              <CardDescription className="break-words">
                #{order.tracking_number} • {(order.sender as any)?.name} → {(order.receiver as any)?.name}
              </CardDescription>
              {order.customer_order_number && (
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  Order #: <span className="font-medium">{order.customer_order_number}</span>
                </p>
              )}
              {/* Order status and storage location badges */}
              <div className="flex min-w-0 flex-wrap gap-2 mt-2">
                <StatusBadge status={order.status} />
                {order.storage_locations && Array.isArray(order.storage_locations) && 
                 order.storage_locations.length > 0 && (
                  <>
                    {order.storage_locations.map((location: any, idx: number) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {location.bay}{location.position}
                      </Badge>
                    ))}
                  </>
                )}
                {(() => {
                  const hasAllocation = Array.isArray(order.storage_locations)
                    ? order.storage_locations.length > 0
                    : !!order.storage_locations;
                  if (hasAllocation || !order.collection_confirmation_sent_at) return null;
                  const driver = getDriverAssignment(
                    { trackingEvents: order.tracking_events } as any,
                    'pickup'
                  );
                  if (!driver) return null;
                  return (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      In {driver}'s van
                    </Badge>
                  );
                })()}
                {canManageInspections && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {order.collection_confirmation_sent_at
                      ? `Collected ${formatDistanceToNowStrict(new Date(order.collection_confirmation_sent_at))} ago`
                      : `Awaiting collection · created ${formatDistanceToNowStrict(new Date(order.created_at))} ago`}
                  </Badge>
                )}
                {canManageInspections && inspection?.id && (
                  <div className="flex min-w-0 w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center">
                    <Badge variant={inspection.bike_type ? "secondary" : "outline"} className="flex min-w-0 max-w-full items-center gap-1 self-start">
                      <Wrench className="h-3 w-3 shrink-0" />
                      <span className="min-w-0 truncate">{inspection.bike_type || "No bike category"}</span>
                    </Badge>
                    <div className="w-full min-w-0 sm:w-[180px]">
                      <BikeCategoryPicker
                        value={inspection.bike_type ?? null}
                        onChange={(v) => updateBikeTypeMutation.mutate({ inspectionId: inspection.id, bikeType: v })}
                        placeholder={inspection.bike_type ? "Change…" : "Set category…"}
                        buttonClassName="h-6 text-[11px]"
                      />
                    </div>
                  </div>
                )}
                {canManageInspections && (
                  (inspection as any)?.external_inspection_id ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        InspectaBike linked
                      </Badge>
                      {(inspection as any)?.external_report_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px]"
                          onClick={() => window.open((inspection as any).external_report_url, "_blank", "noopener")}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" /> View report
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px]"
                      disabled={sendToInspectaBikeMutation.isPending && sendingInspectaBikeOrderId === order.id}
                      onClick={() => sendToInspectaBikeMutation.mutate({ orderId: order.id })}
                    >
                      {sendToInspectaBikeMutation.isPending && sendingInspectaBikeOrderId === order.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-3 w-3" />
                      )}
                      Send to InspectaBike
                    </Button>
                  )
                )}
              </div>


            </div>
            <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
              <Badge variant={badgeConfig.variant} className="max-w-full whitespace-normal text-left sm:whitespace-nowrap sm:text-center">
                {badgeConfig.label}
              </Badge>
              {isAdmin && inspection?.id && (
                <Select
                  value={inspection.status}
                  onValueChange={(value) => {
                    if (value === inspection.status) return;
                    notify.confirm({
                      title: `Change inspection status to "${value}"?`,
                      description: "Manual override — will not send emails or update related flags.",
                      confirmLabel: "Change status",
                      onConfirm: () => adminSetStatusMutation.mutate({ inspectionId: inspection.id, status: value as InspectionStatus }),
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-[180px]">
                    <SelectValue placeholder="Change status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="awaiting_pricing">Awaiting Pricing</SelectItem>
                    <SelectItem value="issues_found">Issues Found</SelectItem>
                    <SelectItem value="awaiting_parts">Awaiting Parts</SelectItem>
                    <SelectItem value="awaiting_repair">Awaiting Repair</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="inspected">Inspected</SelectItem>
                    <SelectItem value="repaired">Repaired</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cleaning tasks (shown pre-repaired-final for every bike) */}
          {inspection && inspection.status !== "repaired" && inspection.status !== "inspected" && (
            <div className="rounded-md border p-3 bg-muted/30 space-y-2">
              <p className="text-sm font-medium">Cleaning</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { key: 'frame' as const, label: 'Clean frame', at: inspection.frame_cleaned_at, by: inspection.frame_cleaned_by_name },
                  { key: 'drivetrain' as const, label: 'Degrease drivetrain', at: inspection.drivetrain_degreased_at, by: inspection.drivetrain_degreased_by_name },
                ]).map((t) => {
                  const done = !!t.at;
                  const canToggle = isAdmin || isMechanic;
                  return (
                    <div key={t.key} className="flex items-center justify-between gap-2 rounded border bg-background p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.label}</p>
                        {done && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            ✓ {t.by || 'Done'} · {new Date(t.at!).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {canToggle ? (
                        <Button
                          size="sm"
                          variant={done ? "outline" : "default"}
                          onClick={() => cleaningMutation.mutate({ inspectionId: inspection.id, task: t.key, done: !done })}
                          disabled={cleaningMutation.isPending}
                          className="shrink-0"
                        >
                          {done ? 'Undo' : 'Mark done'}
                        </Button>
                      ) : (
                        <Badge variant={done ? "secondary" : "outline"} className="shrink-0">
                          {done ? 'Done' : 'Pending'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Issues Section */}
          {orderIssues.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Approved: {approvedCount}
              </Badge>
              <Badge variant="destructive">
                Declined: {declinedCount}
              </Badge>
              {receiverApprovedCount > 0 && (
                <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                  Receiver approved: {receiverApprovedCount}
                </Badge>
              )}
              {isAdmin && (
                <Badge variant="outline">
                  Total repairs: £{totalRepairCost.toFixed(2)}
                </Badge>
              )}
            </div>
          )}

          {/* Offer declined repairs to the receiver */}
          {canManageInspections && offerableIssues.length > 0 && (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/40 min-w-0">
              <p className="text-sm font-medium break-words">
                The customer has approved {approvedCount} repair(s) but has not approved{" "}
                {offerableIssues.length} — worth £{offerableTotal.toFixed(2)}.
              </p>
              <p className="text-xs text-muted-foreground mt-1 break-words">
                Offer this work to the receiver — anything they approve is billed to them.
                {lastOfferedAt && ` Last offered ${new Date(lastOfferedAt).toLocaleString()}.`}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-sky-500 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900"
                onClick={() => offerToReceiverMutation.mutate(order.id)}
                disabled={offerToReceiverMutation.isPending}
              >
                {offerToReceiverMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                {lastOfferedAt ? "Re-send offer to receiver" : "Offer these repairs to the receiver"}
              </Button>
            </div>
          )}

          {/* Issues Section */}
          {orderIssues.length > 0 && (
            <div className="space-y-3">
              {orderIssues.map((issue: InspectionIssue) => (
                <div
                  key={issue.id}
                  className={`p-3 rounded-lg border-l-4 min-w-0 overflow-hidden ${
                    issue.status === "resolved" || issue.status === "approved" || issue.status === "repaired"
                      ? "bg-muted/50 border-green-500"
                      : issue.status === "declined"
                      ? "bg-muted/50 border-destructive"
                      : "bg-muted/50 border-amber-500"
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm flex min-w-0 items-start gap-1 break-words">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {issue.issue_description}
                      </p>
                      {issue.estimated_cost != null && (
                        <p className="text-sm text-muted-foreground mt-1 break-words">
                          {isAwaitingPricing ? "Quoted price:" : "Estimated Cost:"} <span className="font-medium">£{Number(issue.estimated_cost).toFixed(2)}</span>
                          {(issue.parts_cost != null || issue.labour_cost != null) && (
                            <span className="text-xs sm:ml-1">
                              (Parts £{Number(issue.parts_cost || 0).toFixed(2)} + Labour £{Number(issue.labour_cost || 0).toFixed(2)})
                            </span>
                          )}
                        </p>
                      )}
                      {canManageInspections && (issue as any).repair_id && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          From catalogue · {(issue as any).repair_id}
                        </p>
                      )}
                      {canManageInspections && (issue as any).external_fault_id && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Synced from InspectaBike
                        </p>
                      )}


                      {/* Part info — mechanic/admin only */}
                      {canManageInspections && (issue.part_name || issue.part_spec || issue.part_number) && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {issue.part_name && <p>Part: <span className="font-medium text-foreground">{issue.part_name}</span></p>}
                          {issue.part_spec && <p>Spec: <span className="font-medium text-foreground">{issue.part_spec}</span></p>}
                          {issue.part_number && <p>Part #: <span className="font-medium text-foreground">{issue.part_number}</span></p>}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported by {issue.requested_by_name}
                      </p>
                    </div>
                    <Badge variant={getIssueBadgeVariant(issue.status)} className="self-start shrink-0">
                      {issue.status}
                    </Badge>
                  </div>

                  {/* Admin status override — approve / decline / reset to pending */}
                  {isAdmin && (issue.status === "pending" || issue.status === "approved" || issue.status === "declined") && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Admin override:</span>
                      {(["approved", "declined", "pending"] as const).map((target) => (
                        <Button
                          key={target}
                          size="sm"
                          variant={issue.status === target ? "default" : "outline"}
                          disabled={issue.status === target || overrideIssueStatusMutation.isPending}
                          onClick={() => overrideIssueStatusMutation.mutate({ issueId: issue.id, status: target })}
                        >
                          {target === "approved" && <CheckCircle className="h-4 w-4 mr-1" />}
                          {target === "declined" && <XCircle className="h-4 w-4 mr-1" />}
                          {target === "pending" && <RotateCcw className="h-4 w-4 mr-1" />}
                          {target === "approved" ? "Approve" : target === "declined" ? "Decline" : "Reset to pending"}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Edit/delete — mechanics during pricing, admins at any stage */}
                  {(isAdmin || (canManageInspections && isAwaitingPricing)) && editingIssueId !== issue.id && (
                    <div className="mt-3 space-y-2">
                      {(() => {
                        const current = priceInputs[issue.id] ?? {
                          parts: issue.parts_cost != null ? String(issue.parts_cost) : "",
                          labour: issue.labour_cost != null ? String(issue.labour_cost) : "",
                        };
                        const partsNum = parseFloat(current.parts);
                        const labourNum = parseFloat(current.labour);
                        const total = (isFinite(partsNum) ? partsNum : 0) + (isFinite(labourNum) ? labourNum : 0);
                        return (
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="min-w-0 flex-1 sm:min-w-[100px]">
                              <Label className="text-xs">Parts (£)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={current.parts}
                                onChange={(e) => setPriceInputs(prev => ({ ...prev, [issue.id]: { ...current, parts: e.target.value } }))}
                                className="text-sm"
                              />
                            </div>
                            <div className="min-w-0 flex-1 sm:min-w-[100px]">
                              <Label className="text-xs">Labour (£)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={current.labour}
                                onChange={(e) => setPriceInputs(prev => ({ ...prev, [issue.id]: { ...current, labour: e.target.value } }))}
                                className="text-sm"
                              />
                            </div>
                            <div className="text-xs text-muted-foreground sm:pb-2">
                              Total: <span className="font-medium text-foreground">£{total.toFixed(2)}</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                const parts = current.parts.trim() === "" ? 0 : parseFloat(current.parts);
                                const labour = current.labour.trim() === "" ? 0 : parseFloat(current.labour);
                                if (!isFinite(parts) || parts < 0 || !isFinite(labour) || labour < 0) {
                                  toast.error("Enter valid parts and labour prices");
                                  return;
                                }
                                setPriceMutation.mutate({ issueId: issue.id, partsCost: parts, labourCost: labour });
                              }}
                              disabled={setPriceMutation.isPending}
                            >
                              <PoundSterling className="h-4 w-4 mr-1" /> Save
                            </Button>
                          </div>
                        );
                      })()}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingIssueId(issue.id);
                            setEditIssueDraft({
                              description: issue.issue_description || "",
                              partsCost: issue.parts_cost != null ? String(issue.parts_cost) : "",
                              labourCost: issue.labour_cost != null ? String(issue.labour_cost) : "",
                              partName: issue.part_name || "",
                              partSpec: issue.part_spec || "",
                              partNumber: issue.part_number || "",
                              repairId: (issue as any).repair_id ?? null,

                            });
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4 mr-1" /> Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove this issue?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes the issue from the inspection. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteIssueMutation.mutate(issue.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Edit form — mechanics during pricing, admins at any stage */}
                  {(isAdmin || (canManageInspections && isAwaitingPricing)) && editingIssueId === issue.id && (
                    <div className="mt-3 space-y-2 p-3 rounded-md border bg-background min-w-0 overflow-hidden">
                      <div>
                        <Label className="text-xs">Repair (from catalogue)</Label>
                        <RepairPicker
                          bikeType={inspection?.bike_type ?? null}
                          value={editIssueDraft.repairId}
                          onSelect={(sel) => {
                            setEditIssueDraft(prev => ({
                              ...prev,
                              repairId: sel.repair_id,
                              labourCost: sel.labour_price_gbp.toFixed(2),
                              description: prev.description.trim() ? prev.description : sel.repair_name,
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          value={editIssueDraft.description}
                          onChange={(e) => setEditIssueDraft(prev => ({ ...prev, description: e.target.value }))}
                          className="text-sm"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                        <div className="min-w-0">
                          <Label className="text-xs">Parts (£)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={editIssueDraft.partsCost}
                            onChange={(e) => setEditIssueDraft(prev => ({ ...prev, partsCost: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs">Labour (£)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={editIssueDraft.labourCost}
                            onChange={(e) => setEditIssueDraft(prev => ({ ...prev, labourCost: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                        <div className="min-w-0">
                          <Label className="text-xs">Part name</Label>
                          <Input value={editIssueDraft.partName} onChange={(e) => setEditIssueDraft(prev => ({ ...prev, partName: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs">Spec</Label>
                          <Input value={editIssueDraft.partSpec} onChange={(e) => setEditIssueDraft(prev => ({ ...prev, partSpec: e.target.value }))} className="text-sm" />
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs">Part #</Label>
                          <Input value={editIssueDraft.partNumber} onChange={(e) => setEditIssueDraft(prev => ({ ...prev, partNumber: e.target.value }))} className="text-sm" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!editIssueDraft.description.trim()) {
                              toast.error("Description is required");
                              return;
                            }
                            const partsStr = editIssueDraft.partsCost.trim();
                            const labourStr = editIssueDraft.labourCost.trim();
                            const partsVal = partsStr === "" ? null : parseFloat(partsStr);
                            const labourVal = labourStr === "" ? null : parseFloat(labourStr);
                            if (partsVal != null && (!isFinite(partsVal) || partsVal < 0)) {
                              toast.error("Enter a valid parts cost");
                              return;
                            }
                            if (labourVal != null && (!isFinite(labourVal) || labourVal < 0)) {
                              toast.error("Enter a valid labour cost");
                              return;
                            }
                            updateIssueMutation.mutate({
                              issueId: issue.id,
                              fields: {
                                issue_description: editIssueDraft.description.trim(),
                                parts_cost: partsVal,
                                labour_cost: labourVal,
                                part_name: editIssueDraft.partName.trim() || null,
                                part_spec: editIssueDraft.partSpec.trim() || null,
                                part_number: editIssueDraft.partNumber.trim() || null,
                                repair_id: editIssueDraft.repairId,
                              },

                            });
                          }}
                          disabled={updateIssueMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" /> Save changes
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingIssueId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}


                  {/* Parts ordered + arrived toggles (awaiting_parts stage, approved issues) */}
                  {(isAdmin || isMechanic) && isAwaitingParts && (issue.status === "approved") && (
                    <div className="mt-3 flex min-w-0 flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id={`ordered-${issue.id}`}
                          checked={!!issue.parts_ordered}
                          onCheckedChange={(checked) =>
                            togglePartsOrderedMutation.mutate({ issueId: issue.id, ordered: !!checked })
                          }
                        />
                        <Label htmlFor={`ordered-${issue.id}`} className="text-sm cursor-pointer flex min-w-0 flex-wrap items-center gap-1">
                          <PackageCheck className="h-4 w-4 shrink-0" />
                          Parts ordered
                          {issue.parts_ordered && issue.parts_ordered_by_name && (
                            <span className="text-xs text-muted-foreground ml-2">
                              by {issue.parts_ordered_by_name}
                            </span>
                          )}
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id={`parts-${issue.id}`}
                          checked={!!issue.parts_arrived}
                          disabled={!issue.parts_ordered}
                          onCheckedChange={(checked) =>
                            togglePartsArrivedMutation.mutate({ issueId: issue.id, arrived: !!checked })
                          }
                        />
                        <Label
                          htmlFor={`parts-${issue.id}`}
                          className={`text-sm flex min-w-0 flex-wrap items-center gap-1 ${issue.parts_ordered ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                        >
                          <PackageCheck className="h-4 w-4 shrink-0" />
                          Parts arrived
                          {issue.parts_arrived && issue.parts_arrived_by_name && (
                            <span className="text-xs text-muted-foreground ml-2">
                              by {issue.parts_arrived_by_name}
                            </span>
                          )}
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* Customer Response Display */}
                  {issue.customer_response && (
                    <div className="mt-3 p-2 bg-background rounded border">
                      <p className="text-xs text-muted-foreground mb-1">Customer Response:</p>
                      <p className="text-sm">{issue.customer_response}</p>
                    </div>
                  )}

                  {/* Accept/Decline Buttons (for customers) */}
                  {!isAdmin && isOwner && issue.status === "pending" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => acceptIssueMutation.mutate(issue.id)}
                          disabled={acceptIssueMutation.isPending}
                        >
                          {acceptIssueMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => declineIssueMutation.mutate({ 
                            issueId: issue.id, 
                            reason: customerResponses[issue.id] || undefined 
                          })}
                          disabled={declineIssueMutation.isPending}
                        >
                          {declineIssueMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <X className="h-4 w-4 mr-1" />
                          )}
                          Decline
                        </Button>
                      </div>
                      <Input
                        placeholder="Optional: Add notes..."
                        value={customerResponses[issue.id] || ""}
                        onChange={(e) =>
                          setCustomerResponses((prev) => ({
                            ...prev,
                            [issue.id]: e.target.value,
                          }))
                        }
                        className="text-sm"
                      />
                    </div>
                  )}

                  {/* Mark as Repaired Button — awaiting_repair, OR awaiting_parts once this issue's parts have arrived */}
                  {(isAdmin || isMechanic) && issue.status === "approved" && (
                    isAwaitingRepair ||
                    (isAwaitingParts && issue.parts_ordered && issue.parts_arrived)
                  ) && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                        onClick={() => markRepairedMutation.mutate(issue.id)}
                        disabled={markRepairedMutation.isPending}
                      >
                        {markRepairedMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Wrench className="h-4 w-4 mr-1" />
                        )}
                        Mark as Repaired
                      </Button>
                    </div>
                  )}

                  {/* Resolve Button (admin/mechanic, for issues_found status) */}
                  {(isAdmin || isMechanic) && inspection?.status === "issues_found" && (issue.status === "approved" || issue.status === "declined") && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveIssueMutation.mutate(issue.id)}
                        disabled={resolveIssueMutation.isPending}
                      >
                        {resolveIssueMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Mark Resolved
                      </Button>
                    </div>
                  )}

                  {/* Receiver-funded repairs */}
                  {(issue as any).billing_party === "receiver" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                       <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                        Approved by receiver
                        {(issue as any).receiver_approved_source === "staff" ? " (recorded by staff)" : ""}
                      </Badge>
                      {(issue as any).invoice_number && (issue as any).invoice_url && (
                        <Badge
                          className="cursor-pointer bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200"
                          onClick={() => window.open((issue as any).invoice_url, "_blank")}
                        >
                          Invoice #{(issue as any).invoice_number}
                        </Badge>
                      )}
                      {(issue as any).invoice_public_url && (
                        <Badge
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => window.open((issue as any).invoice_public_url, "_blank")}
                        >
                          Customer link
                        </Badge>
                      )}
                      {canManageInspections && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => undoReceiverApprovalMutation.mutate(issue.id)}
                          disabled={undoReceiverApprovalMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Undo
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Admin/mechanic: record that the receiver (not the customer) approved this repair */}
                  {canManageInspections && issue.status === "declined" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sky-500 text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950"
                        onClick={() => receiverApproveMutation.mutate(issue.id)}
                        disabled={receiverApproveMutation.isPending}
                      >
                        {receiverApproveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Receiver approved — do this repair
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950"
                        onClick={() => reinstateIssueMutation.mutate(issue.id)}
                        disabled={reinstateIssueMutation.isPending}
                      >
                        {reinstateIssueMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-1" />
                        )}
                        Customer approved — undo decline

                      </Button>
                      {(issue as any).receiver_declined_at && (
                        <span className="text-xs text-muted-foreground">
                          Receiver declined {new Date((issue as any).receiver_declined_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add-issue inline form (awaiting_pricing, or extra work after approval) */}
          {canManageInspections && (isAwaitingPricing || isPostApproval) && inspection && (
            <div className="pt-1">
              {addIssueForInspectionId === inspection.id ? (
                <div className="space-y-2 p-3 rounded-md border bg-background min-w-0 overflow-hidden">
                  {isPostApproval && (
                    <div>
                      <Label className="text-xs">Who pays?</Label>
                      <Select
                        value={newIssueDraft.payer}
                        onValueChange={(v) => setNewIssueDraft(prev => ({ ...prev, payer: v as "customer" | "receiver" }))}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Booking customer (account)</SelectItem>
                          {isAdmin && <SelectItem value="receiver">Receiver (invoice now)</SelectItem>}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Added as approved work at the current stage. Receiver-billed repairs are invoiced immediately.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Repair (from catalogue)</Label>
                    <RepairPicker
                      bikeType={inspection?.bike_type ?? null}
                      value={newIssueDraft.repairId}
                      onSelect={(sel) => {
                        setNewIssueDraft(prev => ({
                          ...prev,
                          repairId: sel.repair_id,
                          labourCost: sel.labour_price_gbp.toFixed(2),
                          description: prev.description.trim() ? prev.description : sel.repair_name,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={newIssueDraft.description}
                      onChange={(e) => setNewIssueDraft(prev => ({ ...prev, description: e.target.value }))}
                      className="text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    <div className="min-w-0">
                      <Label className="text-xs">Parts (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newIssueDraft.partsCost}
                        onChange={(e) => setNewIssueDraft(prev => ({ ...prev, partsCost: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Labour (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newIssueDraft.labourCost}
                        onChange={(e) => setNewIssueDraft(prev => ({ ...prev, labourCost: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                    <div className="min-w-0">
                      <Label className="text-xs">Part name</Label>
                      <Input value={newIssueDraft.partName} onChange={(e) => setNewIssueDraft(prev => ({ ...prev, partName: e.target.value }))} className="text-sm" />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Spec</Label>
                      <Input value={newIssueDraft.partSpec} onChange={(e) => setNewIssueDraft(prev => ({ ...prev, partSpec: e.target.value }))} className="text-sm" />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs">Part #</Label>
                      <Input value={newIssueDraft.partNumber} onChange={(e) => setNewIssueDraft(prev => ({ ...prev, partNumber: e.target.value }))} className="text-sm" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!newIssueDraft.description.trim()) {
                          toast.error("Description is required");
                          return;
                        }
                        const costStr = newIssueDraft.cost.trim();
                        if (costStr !== "" && (!isFinite(parseFloat(costStr)) || parseFloat(costStr) < 0)) {
                          toast.error("Enter a valid cost");
                          return;
                        }
                        if (isPostApproval && !newIssueDraft.partsCost.trim() && !newIssueDraft.labourCost.trim() && costStr === "") {
                          toast.error("Enter a parts and/or labour price — there's no pricing round after approval");
                          return;
                        }
                        addIssueAtPricingMutation.mutate({ inspectionId: inspection.id, orderId: order.id, draft: newIssueDraft, postApproval: isPostApproval });

                      }}
                      disabled={addIssueAtPricingMutation.isPending}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add issue
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddIssueForInspectionId(null); setNewIssueDraft({ description: "", cost: "", partsCost: "", labourCost: "", partName: "", partSpec: "", partNumber: "", repairId: null, payer: "customer" }); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddIssueForInspectionId(inspection.id)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add issue
                </Button>
              )}
            </div>
          )}



          {/* Release to Customer Button (admin only, awaiting_pricing once all priced) */}
          {isAdmin && isAwaitingPricing && allPriced && (
            <div className="pt-2">
              <Button
                onClick={() => releaseMutation.mutate(inspection.id)}
                disabled={releaseMutation.isPending}
              >
                {releaseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Release to Customer
              </Button>
            </div>
          )}

          {/* Complete Repairs Button (admin/mechanic for awaiting_repair when all approved are repaired) */}
          {(isAdmin || isMechanic) && isAwaitingRepair && allApprovedRepaired && (
            <div className="pt-2">
              <Button
                onClick={() => completeRepairsMutation.mutate(inspection.id)}
                disabled={completeRepairsMutation.isPending}
              >
                {completeRepairsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Complete Repairs
              </Button>
            </div>
          )}

          {/* Admin Actions for awaiting inspection */}
          {canManageInspections && (!inspection || inspection.status === "pending") && (
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                size="sm"
                onClick={() => handleOpenInspectionChecklist(order.id)}
              >
                <Wrench className="h-4 w-4 mr-1" />
                Start Inspection
              </Button>
            </div>
          )}

          {/* Inspection Info */}
          {inspection?.inspected_at && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground break-words">
                Inspected by {inspection.inspected_by_name} on{" "}
                {new Date(inspection.inspected_at).toLocaleDateString()}
              </p>
              {(isAdmin || isMechanic) && inspection?.status === "inspected" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resetToPendingMutation.mutate(inspection.id)}
                  disabled={resetToPendingMutation.isPending}
                >
                  {resetToPendingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-1" />
                  )}
                  Reset to Awaiting
                </Button>
              )}
            </div>
          )}

          {/* Invoice Section */}
          {hasInvoice && (
              <div className="flex min-w-0 flex-wrap items-center gap-2 pt-2">
                <Badge variant="outline" className="flex min-w-0 max-w-full items-center gap-1">
                  <FileText className="h-3 w-3 shrink-0" />
                Invoice: {inspection.invoice_number}
              </Badge>
              {inspection.invoice_url && (
                <a
                  href={inspection.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              )}
              {(inspection as any).invoice_public_url && (
                <a
                  href={(inspection as any).invoice_public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                  Customer link
                </a>
              )}
            </div>

          )}

          {canCreateInvoice && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => createInvoiceMutation.mutate({ inspectionId: inspection.id })}
                disabled={createInvoiceMutation.isPending}
              >
                {createInvoiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                Create Invoice
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSkipInvoiceDialog({ open: true, inspectionId: inspection.id, reason: "" })
                }
              >
                <X className="h-4 w-4 mr-1" />
                No invoice needed
              </Button>
            </div>
          )}

          {(() => {
            const reason = getSettledReason(order);
            if (
              reason !== "no_issues" &&
              reason !== "declined" &&
              reason !== "zero_value" &&
              reason !== "receiver_billed"
            )
              return null;
            return (
              <div className="flex min-w-0 flex-wrap items-center gap-2 pt-2">
                <Badge variant="secondary" className="flex min-w-0 max-w-full items-center gap-1">
                  <X className="h-3 w-3 shrink-0" />
                  {reason === "no_issues"
                    ? "No issues"
                    : reason === "declined"
                      ? "Repairs declined"
                      : reason === "receiver_billed"
                        ? "Receiver pays"
                        : "£0 — nothing to bill"}
                </Badge>

                <span className="min-w-0 text-xs text-muted-foreground break-words">
                  {reason === "receiver_billed"
                    ? `Nothing to invoice the customer${receiverBilledTotal > 0 ? ` — £${receiverBilledTotal.toFixed(2)} billed to receiver` : ""}`
                    : "Nothing to invoice"}
                </span>
              </div>
            );
          })()}


          {invoiceSkipped && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 pt-2">
              <Badge variant="secondary" className="flex min-w-0 max-w-full items-center gap-1">
                <X className="h-3 w-3 shrink-0" />
                Not invoiced
              </Badge>
              <span className="min-w-0 text-xs text-muted-foreground break-words">
                {inspection.invoice_skip_reason || "No reason given"}
                {inspection.invoice_skipped_by_name
                  ? ` — ${inspection.invoice_skipped_by_name}`
                  : ""}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => clearSkipMutation.mutate(inspection.id)}
                  disabled={clearSkipMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Make invoiceable again
                </Button>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="container py-4 sm:py-6 overflow-x-hidden">
        <DashboardHeader>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
              {isAdmin ? "Bicycle Inspections" : "My Inspections"}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Manage bike inspections and report issues"
                : "View inspection status for your bikes"}
            </p>
          </div>
        </DashboardHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : inspections.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                No bikes requiring inspection
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="awaiting" className="space-y-4 min-w-0">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="relative w-full min-w-0 sm:flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by tracking #, order #, bike or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {canManageInspections && (
                <div className="flex min-w-0 w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="sort-inspections" className="text-sm text-muted-foreground">
                    Sort by:
                  </Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger id="sort-inspections" className="w-full min-w-0 sm:w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oldest_collected">Oldest collected first</SelectItem>
                      <SelectItem value="newest_collected">Newest collected first</SelectItem>
                      <SelectItem value="tracking_asc">Tracking # A→Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {canManageInspections && (
              <InspectionFilters
                filters={filters}
                onChange={setFilters}
                options={filterOptions}
                showBilling={isAdmin}
              />
            )}
            <div className="w-full">
            <TabsList className="grid w-full grid-cols-1 gap-1 h-auto sm:flex sm:flex-wrap">
              <TabsTrigger value="awaiting" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Awaiting
                {awaitingInspection.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {awaitingInspection.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="collected" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Collected
                {collected.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {collected.length}
                  </Badge>
                )}
              </TabsTrigger>
              {canManageInspections && (
                <TabsTrigger value="pricing" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                  Pricing
                  {awaitingPricing.length > 0 && (
                    <Badge variant="warning" className="ml-1">{awaitingPricing.length}</Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="issues" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Issues
                {withIssues.length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {withIssues.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="awaiting-parts" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Awaiting Parts
                {awaitingParts.length > 0 && (
                  <Badge variant="warning" className="ml-1">{awaitingParts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="awaiting-repair" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Awaiting Repair
                {awaitingRepair.length > 0 && (
                  <Badge variant="warning" className="ml-1">{awaitingRepair.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inspected-serviced" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Inspected &amp; Serviced
                {inspectedAndServiced.length > 0 && (
                  <Badge variant="success" className="ml-1">
                    {inspectedAndServiced.length}
                  </Badge>
                )}
              </TabsTrigger>
              {canManageInspections && (
                <TabsTrigger value="invoiced" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                  Invoiced
                  {invoicedList.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{invoicedList.length}</Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="schedule" className="w-full justify-start sm:w-auto sm:justify-center flex items-center gap-1">
                Schedule
              </TabsTrigger>
            </TabsList>
            </div>

            <TabsContent value="awaiting" className="space-y-4">
              {awaitingInspection.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes awaiting inspection
                </p>
              ) : (
                awaitingInspection.map(renderInspectionCard)
              )}
            </TabsContent>

            <TabsContent value="collected" className="space-y-4">
              {collected.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No collected bikes awaiting inspection
                </p>
              ) : (
                collected.map(renderInspectionCard)
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              {withIssues.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes with issues awaiting customer response
                </p>
              ) : (
                withIssues.map(renderInspectionCard)
              )}
            </TabsContent>

            {canManageInspections && (
              <TabsContent value="pricing" className="space-y-4">
                {awaitingPricing.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No bikes awaiting pricing</p>
                ) : (
                  awaitingPricing.map(renderInspectionCard)
                )}
              </TabsContent>
            )}

            <TabsContent value="awaiting-parts" className="space-y-4">
              {awaitingParts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bikes awaiting parts</p>
              ) : (
                awaitingParts.map(renderInspectionCard)
              )}
            </TabsContent>

            <TabsContent value="awaiting-repair" className="space-y-4">
              {awaitingRepair.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bikes currently in repair</p>
              ) : (
                awaitingRepair.map(renderInspectionCard)
              )}
            </TabsContent>

            <TabsContent value="inspected-serviced" className="space-y-4">
              {inspectedAndServiced.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes inspected and serviced yet
                </p>
              ) : (
                inspectedAndServiced.map(renderInspectionCard)
              )}
            </TabsContent>

            {canManageInspections && (
              <TabsContent value="invoiced" className="space-y-4">
                {invoicedList.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No invoiced jobs yet
                  </p>
                ) : (
                  invoicedList.map(renderInspectionCard)
                )}
              </TabsContent>
            )}

            <TabsContent value="schedule" className="space-y-4">
              <WorkshopScheduleTab canManage={isAdmin} />
            </TabsContent>
          </Tabs>
        )}


        {/* Inspection Checklist Dialog */}
        <Dialog open={inspectionChecklistOpen} onOpenChange={setInspectionChecklistOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg p-4 sm:p-6 max-h-[85vh] overflow-y-auto [&>*]:min-w-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Bike Inspection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 min-w-0">
              <p className="text-sm text-muted-foreground">
                Complete each inspection item. Report any issues found under each section.
              </p>

              {/* Bike category — required when reporting issues, filters the repair catalogue */}
              <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
                <Label className="text-sm font-medium">Bike category</Label>
                <BikeCategoryPicker
                  value={checklistBikeType}
                  onChange={setChecklistBikeType}
                  placeholder="Choose bike category to unlock repair catalogue…"
                />
                <p className="text-[11px] text-muted-foreground">
                  Required before reporting issues — filters the repair catalogue to matching labour times.
                </p>
              </div>

              {INSPECTION_ITEMS.map((item) => {
                const itemIssues = checklistIssues[item.id] || [];
                return (
                  <div key={item.id} className="space-y-3 p-2 sm:p-3 border rounded-lg min-w-0">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={item.id}
                        checked={inspectionChecklist[item.id] || false}
                        onCheckedChange={() => handleChecklistItemToggle(item.id)}
                      />
                      <Label htmlFor={item.id} className="text-sm font-medium cursor-pointer leading-tight">
                        {item.label}
                      </Label>
                    </div>
                    {inspectionChecklist[item.id] && (
                      <div className="ml-4 sm:ml-7 space-y-3 min-w-0">
                        <Input
                          placeholder="Optional: Add notes..."
                          value={inspectionComments[item.id] || ""}
                          onChange={(e) => handleChecklistCommentChange(item.id, e.target.value)}
                          className="text-sm"
                        />
                        
                        {/* Issues for this checklist item */}
                        {itemIssues.map((issue, idx) => (
                          <div key={idx} className="space-y-2 p-2 sm:p-3 bg-muted/50 rounded-md border border-dashed border-destructive/30 min-w-0 overflow-hidden">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Issue #{idx + 1}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleRemoveChecklistIssue(item.id, idx)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <RepairPicker
                              bikeType={checklistBikeType}
                              value={issue.repairId}
                              onSelect={(sel) => {
                                patchChecklistIssue(item.id, idx, {
                                  repairId: sel.repair_id,
                                  labourCost: sel.labour_price_gbp.toFixed(2),
                                  description: issue.description.trim() ? issue.description : sel.repair_name,
                                });
                              }}
                            />
                            {issue.repairId && (
                              <p className="text-[10px] text-muted-foreground">
                                From catalogue · labour auto-priced at current workshop rate
                              </p>
                            )}
                            <Textarea
                              placeholder="Describe the issue..."
                              value={issue.description}
                              onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'description', e.target.value)}
                              className="text-sm min-h-[60px]"
                            />
                            <div className="grid grid-cols-2 gap-2 min-w-0">
                              <div className="min-w-0">
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Parts (£)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={issue.partsCost}
                                  onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'partsCost', e.target.value)}
                                  className="text-sm w-full"
                                />
                              </div>
                              <div className="min-w-0">
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Labour (£)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={issue.labourCost}
                                  onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'labourCost', e.target.value)}
                                  className="text-sm w-full"
                                />
                              </div>
                            </div>

                            {canManageInspections && (
                              <div className="space-y-2 pt-1 border-t border-dashed border-muted-foreground/20">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Part details (mechanic/admin only)
                                </p>
                                <Input
                                  placeholder="Part name"
                                  value={issue.partName}
                                  onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'partName', e.target.value)}
                                  className="text-sm"
                                />
                                <Input
                                  placeholder="Spec"
                                  value={issue.partSpec}
                                  onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'partSpec', e.target.value)}
                                  className="text-sm"
                                />
                                <Input
                                  placeholder="Part number"
                                  value={issue.partNumber}
                                  onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'partNumber', e.target.value)}
                                  className="text-sm"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleAddChecklistIssue(item.id)}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Report Issue
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {hasIssues && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium text-destructive">
                    {allChecklistIssues.length} issue{allChecklistIssues.length !== 1 ? 's' : ''} will be reported to the customer
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInspectionChecklistOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmInspection}
                disabled={!allItemsChecked || markInspectedMutation.isPending || addMultipleIssuesMutation.isPending}
                variant={hasIssues ? "destructive" : "default"}
              >
                {(markInspectedMutation.isPending || addMultipleIssuesMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : hasIssues ? (
                  <AlertTriangle className="h-4 w-4 mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                {hasIssues ? `Submit ${allChecklistIssues.length} Issue${allChecklistIssues.length !== 1 ? 's' : ''}` : 'Complete - No Issues'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={skipInvoiceDialog.open}
          onOpenChange={(open) => setSkipInvoiceDialog((prev) => ({ ...prev, open }))}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>No invoice needed</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="skip-invoice-reason" className="text-xs">
                Reason (optional)
              </Label>
              <Textarea
                id="skip-invoice-reason"
                placeholder="e.g. goodwill, covered under warranty, internal bike"
                value={skipInvoiceDialog.reason}
                onChange={(e) =>
                  setSkipInvoiceDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setSkipInvoiceDialog({ open: false, inspectionId: null, reason: "" })}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={skipInvoiceMutation.isPending || !skipInvoiceDialog.inspectionId}
                onClick={() =>
                  skipInvoiceDialog.inspectionId &&
                  skipInvoiceMutation.mutate({
                    inspectionId: skipInvoiceDialog.inspectionId,
                    reason: skipInvoiceDialog.reason,
                  })
                }
              >
                {skipInvoiceMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                )}
                Mark as not invoiced
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BillingCustomerDialog
          open={billingDialogState.open}
          onOpenChange={(open) =>
            setBillingDialogState((prev) => ({ ...prev, open }))
          }
          suggestions={billingDialogState.suggestions}
          triedEmails={billingDialogState.triedEmails}
          isSubmitting={createInvoiceMutation.isPending}
          onConfirm={({ quickbooksCustomerId, billingEmailOverride }) => {
            if (!billingDialogState.inspectionId) return;
            createInvoiceMutation.mutate({
              inspectionId: billingDialogState.inspectionId,
              quickbooksCustomerId,
              billingEmailOverride,
            });
          }}
        />
      </div>
    </Layout>
  );

};

export default BicycleInspections;
