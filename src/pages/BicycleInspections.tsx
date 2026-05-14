import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { Wrench, CheckCircle, AlertTriangle, Loader2, RotateCcw, X, MapPin, FileText, ExternalLink, Clock, ArrowUpDown, PoundSterling, PackageCheck, Send } from "lucide-react";
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
} from "@/services/inspectionService";
import { InspectionIssue } from "@/types/inspection";

interface IssueEntry {
  description: string;
  estimatedCost: string;
  partName: string;
  partSpec: string;
  partNumber: string;
}

interface ChecklistIssue {
  description: string;
  estimatedCost: string;
  partName: string;
  partSpec: string;
  partNumber: string;
}

// Standard inspection checklist items
const INSPECTION_ITEMS = [
  { id: 'brakes_gears', label: 'Brake and gear tuning' },
  { id: 'safety_inspection', label: 'Full safety inspection (frame, wheels, drivetrain, tyres)' },
  { id: 'tyre_pressure', label: 'Tyre pressure check and adjustment' },
  { id: 'cleaning_bolts', label: 'Light cleaning and bolt tightening' },
];

const BicycleInspections = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userProfile?.role === "admin";
  const isMechanic = userProfile?.role === "mechanic";
  const canManageInspections = isAdmin || isMechanic;

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [issueCount, setIssueCount] = useState(1);
  const [issues, setIssues] = useState<IssueEntry[]>([{ description: "", estimatedCost: "", partName: "", partSpec: "", partNumber: "" }]);
  // Per-issue price input for the awaiting-pricing stage
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [customerResponses, setCustomerResponses] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<"oldest_collected" | "newest_collected" | "tracking_asc">("oldest_collected");
  
  // Inspection checklist dialog state
  const [inspectionChecklistOpen, setInspectionChecklistOpen] = useState(false);
  const [selectedOrderForInspection, setSelectedOrderForInspection] = useState<string | null>(null);
  const [inspectionChecklist, setInspectionChecklist] = useState<Record<string, boolean>>({});
  const [inspectionComments, setInspectionComments] = useState<Record<string, string>>({});
  const [checklistIssues, setChecklistIssues] = useState<Record<string, ChecklistIssue[]>>({});

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
    mutationFn: async ({ orderId, issues }: { orderId: string; issues: IssueEntry[] }) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }

      const results = [];
      for (const issue of issues) {
        if (issue.description.trim()) {
          const cost = issue.estimatedCost ? parseFloat(issue.estimatedCost) : null;
          const result = await addInspectionIssue(
            orderId,
            issue.description,
            cost,
            user.id,
            userProfile.name || user.email || "Admin",
            {
              part_name: issue.partName?.trim() || null,
              part_spec: issue.partSpec?.trim() || null,
              part_number: issue.partNumber?.trim() || null,
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
    mutationFn: async ({ issueId, price }: { issueId: string; price: number }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return setIssuePrice(issueId, price, user.id, userProfile?.name || user.email || "Admin");
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

  // Create inspection invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (inspectionId: string) => {
      const { data, error } = await supabase.functions.invoke('create-inspection-invoice', {
        body: { inspectionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success(`Invoice ${data.invoiceNumber} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create invoice");
      console.error(error);
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
      [itemId]: [...(prev[itemId] || []), { description: "", estimatedCost: "", partName: "", partSpec: "", partNumber: "" }]
    }));
  };

  const handleRemoveChecklistIssue = (itemId: string, index: number) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter((_, i) => i !== index)
    }));
  };

  const handleUpdateChecklistIssue = (itemId: string, index: number, field: 'description' | 'estimatedCost' | 'partName' | 'partSpec' | 'partNumber', value: string) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).map((issue, i) =>
        i === index ? { ...issue, [field]: value } : issue
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
        description: `[${itemLabel}] ${issue.description}`,
        estimatedCost: issue.estimatedCost,
        partName: issue.partName,
        partSpec: issue.partSpec,
        partNumber: issue.partNumber,
      }));
  });

  const hasIssues = allChecklistIssues.length > 0;

  const handleConfirmInspection = async () => {
    if (!selectedOrderForInspection || !allItemsChecked) return;

    if (hasIssues) {
      addMultipleIssuesMutation.mutate({ orderId: selectedOrderForInspection, issues: allChecklistIssues });
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
        return [...prev, ...Array(newCount - prev.length).fill(null).map(() => ({ description: "", estimatedCost: "", partName: "", partSpec: "", partNumber: "" }))];
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
    setIssues([{ description: "", estimatedCost: "", partName: "", partSpec: "", partNumber: "" }]);
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

  // Filter inspections by status
  const awaitingInspection = sortedInspections.filter((i: any) => !i.inspection || i.inspection.status === "pending");
  const awaitingPricing = sortedInspections.filter((i: any) => i.inspection?.status === "awaiting_pricing");
  const withIssues = sortedInspections.filter((i: any) => i.inspection?.status === "issues_found");
  const awaitingParts = sortedInspections.filter((i: any) => i.inspection?.status === "awaiting_parts");
  const awaitingRepair = sortedInspections.filter((i: any) => i.inspection?.status === "awaiting_repair" || i.inspection?.status === "in_repair");
  const inspectedAndServiced = sortedInspections.filter((i: any) => i.inspection?.status === "inspected" || i.inspection?.status === "repaired");

  const renderInspectionCard = (order: any) => {
    const inspection = order.inspection;
    const orderIssues = order.issues || [];
    const pendingIssues = orderIssues.filter((issue: InspectionIssue) => issue.status === "pending");
    const approvedIssues = orderIssues.filter((issue: InspectionIssue) => issue.status === "approved" || issue.status === "repaired");
    const isOwner = order.user_id === user?.id;
    const badgeConfig = getInspectionBadge(inspection?.status);
    const allApprovedRepaired = checkAllApprovedRepaired(orderIssues);
    const hasInvoice = !!inspection?.invoice_number;
    const canCreateInvoice = isAdmin && (inspection?.status === "repaired" || inspection?.status === "inspected") && approvedIssues.length > 0 && !hasInvoice;
    const isAwaitingPricing = inspection?.status === "awaiting_pricing";
    const isAwaitingParts = inspection?.status === "awaiting_parts";
    const isAwaitingRepair = inspection?.status === "awaiting_repair" || inspection?.status === "in_repair";
    const allPriced = orderIssues.length > 0 && orderIssues.every((i: InspectionIssue) => i.estimated_cost != null);
    const approvedCount = approvedIssues.length;
    const partsArrivedCount = approvedIssues.filter((i: InspectionIssue) => i.parts_arrived || i.status === 'repaired' || i.status === 'resolved').length;


    return (
      <Card key={order.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-5 w-5" />
                {order.bike_brand} {order.bike_model}
                {order.bike_quantity > 1 && (
                  <Badge variant="secondary">x{order.bike_quantity}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                #{order.tracking_number} • {(order.sender as any)?.name} → {(order.receiver as any)?.name}
              </CardDescription>
              {order.customer_order_number && (
                <p className="text-xs text-muted-foreground mt-1">
                  Order #: <span className="font-medium">{order.customer_order_number}</span>
                </p>
              )}
              {/* Order status and storage location badges */}
              <div className="flex flex-wrap gap-2 mt-2">
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
                {canManageInspections && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {order.collection_confirmation_sent_at
                      ? `Collected ${formatDistanceToNowStrict(new Date(order.collection_confirmation_sent_at))} ago`
                      : `Awaiting collection · created ${formatDistanceToNowStrict(new Date(order.created_at))} ago`}
                  </Badge>
                )}
              </div>
            </div>
            <Badge variant={badgeConfig.variant}>
              {badgeConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Issues Section */}
          {orderIssues.length > 0 && (
            <div className="space-y-3">
              {orderIssues.map((issue: InspectionIssue) => (
                <div
                  key={issue.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    issue.status === "resolved" || issue.status === "approved" || issue.status === "repaired"
                      ? "bg-muted/50 border-green-500"
                      : issue.status === "declined"
                      ? "bg-muted/50 border-destructive"
                      : "bg-muted/50 border-amber-500"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        {issue.issue_description}
                      </p>
                      {issue.estimated_cost != null && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {isAwaitingPricing ? "Quoted price:" : "Estimated Cost:"} <span className="font-medium">£{Number(issue.estimated_cost).toFixed(2)}</span>
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
                    <Badge variant={getIssueBadgeVariant(issue.status)}>
                      {issue.status}
                    </Badge>
                  </div>

                  {/* Admin pricing input (awaiting_pricing stage) */}
                  {isAdmin && isAwaitingPricing && (
                    <div className="mt-3 flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Price (£)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={priceInputs[issue.id] ?? (issue.estimated_cost != null ? String(issue.estimated_cost) : "")}
                          onChange={(e) => setPriceInputs(prev => ({ ...prev, [issue.id]: e.target.value }))}
                          className="text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const raw = priceInputs[issue.id] ?? (issue.estimated_cost != null ? String(issue.estimated_cost) : "");
                          const val = parseFloat(raw);
                          if (!isFinite(val) || val < 0) {
                            toast.error("Enter a valid price");
                            return;
                          }
                          setPriceMutation.mutate({ issueId: issue.id, price: val });
                        }}
                        disabled={setPriceMutation.isPending}
                      >
                        <PoundSterling className="h-4 w-4 mr-1" /> Save
                      </Button>
                    </div>
                  )}

                  {/* Parts arrived toggle (awaiting_parts stage, approved issues) */}
                  {(isAdmin || isMechanic) && isAwaitingParts && (issue.status === "approved") && (
                    <div className="mt-3 flex items-center gap-2">
                      <Checkbox
                        id={`parts-${issue.id}`}
                        checked={!!issue.parts_arrived}
                        onCheckedChange={(checked) =>
                          togglePartsArrivedMutation.mutate({ issueId: issue.id, arrived: !!checked })
                        }
                      />
                      <Label htmlFor={`parts-${issue.id}`} className="text-sm cursor-pointer flex items-center gap-1">
                        <PackageCheck className="h-4 w-4" />
                        Parts arrived
                        {issue.parts_arrived && issue.parts_arrived_by_name && (
                          <span className="text-xs text-muted-foreground ml-2">
                            by {issue.parts_arrived_by_name}
                          </span>
                        )}
                      </Label>
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
                      <div className="flex gap-2">
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

                  {/* Mark as Repaired Button (admin/mechanic for awaiting_repair status, approved issues) */}
                  {(isAdmin || isMechanic) && isAwaitingRepair && issue.status === "approved" && (
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
                </div>
              ))}
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
            <div className="flex gap-2 pt-2">
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
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
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Invoice: {inspection.invoice_number}
              </Badge>
              {inspection.invoice_url && (
                <a
                  href={inspection.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </a>
              )}
            </div>
          )}

          {canCreateInvoice && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => createInvoiceMutation.mutate(inspection.id)}
                disabled={createInvoiceMutation.isPending}
              >
                {createInvoiceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <FileText className="h-4 w-4 mr-1" />
                )}
                Create Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="container py-6">
        <DashboardHeader>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="h-8 w-8" />
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
          <Tabs defaultValue="awaiting" className="space-y-4">
            {canManageInspections && (
              <div className="flex items-center justify-end gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="sort-inspections" className="text-sm text-muted-foreground">
                  Sort by:
                </Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger id="sort-inspections" className="w-[220px]">
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
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="awaiting" className="flex items-center gap-1">
                Awaiting
                {awaitingInspection.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {awaitingInspection.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="issues" className="flex items-center gap-1">
                Issues
                {withIssues.length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {withIssues.length}
                  </Badge>
                )}
              </TabsTrigger>
              {canManageInspections && (
                <TabsTrigger value="pricing" className="flex items-center gap-1">
                  Pricing
                  {awaitingPricing.length > 0 && (
                    <Badge variant="warning" className="ml-1">{awaitingPricing.length}</Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="awaiting-parts" className="flex items-center gap-1">
                Awaiting Parts
                {awaitingParts.length > 0 && (
                  <Badge variant="warning" className="ml-1">{awaitingParts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="awaiting-repair" className="flex items-center gap-1">
                Awaiting Repair
                {awaitingRepair.length > 0 && (
                  <Badge variant="warning" className="ml-1">{awaitingRepair.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inspected-serviced" className="flex items-center gap-1">
                Inspected &amp; Serviced
                {inspectedAndServiced.length > 0 && (
                  <Badge variant="success" className="ml-1">
                    {inspectedAndServiced.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="awaiting" className="space-y-4">
              {awaitingInspection.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes awaiting inspection
                </p>
              ) : (
                awaitingInspection.map(renderInspectionCard)
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
          </Tabs>
        )}

        {/* Inspection Checklist Dialog */}
        <Dialog open={inspectionChecklistOpen} onOpenChange={setInspectionChecklistOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Bike Inspection
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Complete each inspection item. Report any issues found under each section.
              </p>
              {INSPECTION_ITEMS.map((item) => {
                const itemIssues = checklistIssues[item.id] || [];
                return (
                  <div key={item.id} className="space-y-3 p-3 border rounded-lg">
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
                      <div className="ml-7 space-y-3">
                        <Input
                          placeholder="Optional: Add notes..."
                          value={inspectionComments[item.id] || ""}
                          onChange={(e) => handleChecklistCommentChange(item.id, e.target.value)}
                          className="text-sm"
                        />
                        
                        {/* Issues for this checklist item */}
                        {itemIssues.map((issue, idx) => (
                          <div key={idx} className="space-y-2 p-3 bg-muted/50 rounded-md border border-dashed border-destructive/30">
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
                            <Textarea
                              placeholder="Describe the issue..."
                              value={issue.description}
                              onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'description', e.target.value)}
                              className="text-sm min-h-[60px]"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Estimated cost (£) — optional"
                              value={issue.estimatedCost}
                              onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'estimatedCost', e.target.value)}
                              className="text-sm"
                            />
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
      </div>
    </Layout>
  );
};

export default BicycleInspections;
