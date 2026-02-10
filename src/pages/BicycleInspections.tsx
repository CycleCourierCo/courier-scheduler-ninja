import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wrench, CheckCircle, AlertTriangle, Loader2, RotateCcw, X, MapPin } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
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
} from "@/services/inspectionService";
import { InspectionIssue } from "@/types/inspection";

interface IssueEntry {
  description: string;
  estimatedCost: string;
}

interface ChecklistIssue {
  description: string;
  estimatedCost: string;
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
  const [issues, setIssues] = useState<IssueEntry[]>([{ description: "", estimatedCost: "" }]);
  const [customerResponses, setCustomerResponses] = useState<Record<string, string>>({});
  
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
            userProfile.name || user.email || "Admin"
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
      toast.success("Issues reported successfully");
    },
    onError: (error) => {
      toast.error("Failed to report issues");
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
      [itemId]: [...(prev[itemId] || []), { description: "", estimatedCost: "" }]
    }));
  };

  const handleRemoveChecklistIssue = (itemId: string, index: number) => {
    setChecklistIssues(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter((_, i) => i !== index)
    }));
  };

  const handleUpdateChecklistIssue = (itemId: string, index: number, field: 'description' | 'estimatedCost', value: string) => {
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
  const allChecklistIssues = Object.entries(checklistIssues).flatMap(([itemId, issues]) => {
    const itemLabel = INSPECTION_ITEMS.find(i => i.id === itemId)?.label || itemId;
    return issues
      .filter(issue => issue.description.trim())
      .map(issue => ({
        description: `[${itemLabel}] ${issue.description}`,
        estimatedCost: issue.estimatedCost,
      }));
  });

  const hasIssues = allChecklistIssues.length > 0;

  const handleConfirmInspection = async () => {
    if (!selectedOrderForInspection || !allItemsChecked) return;
    
    if (hasIssues) {
      // Submit issues via the existing mutation
      const validIssues = allChecklistIssues.map(i => ({
        description: i.description,
        estimatedCost: i.estimatedCost,
      }));
      addMultipleIssuesMutation.mutate({ orderId: selectedOrderForInspection, issues: validIssues });
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
        return [...prev, ...Array(newCount - prev.length).fill(null).map(() => ({ description: "", estimatedCost: "" }))];
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  const updateIssue = (index: number, field: 'description' | 'estimatedCost', value: string) => {
    setIssues(prev => prev.map((issue, i) => 
      i === index ? { ...issue, [field]: value } : issue
    ));
  };

  const resetIssueForm = () => {
    setIssueCount(1);
    setIssues([{ description: "", estimatedCost: "" }]);
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
      case "issues_found":
        return { variant: "destructive" as const, label: "Issues Found" };
      case "in_repair":
        return { variant: "warning" as const, label: "In Repair" };
      case "repaired":
        return { variant: "success" as const, label: "Repaired" };
      default:
        return { variant: "secondary" as const, label: "Awaiting Inspection" };
    }
  };

  // Filter inspections by status
  const awaitingInspection = inspections.filter((i: any) => !i.inspection || i.inspection.status === "pending");
  const noIssues = inspections.filter((i: any) => i.inspection?.status === "inspected");
  const withIssues = inspections.filter((i: any) => i.inspection?.status === "issues_found");
  const inRepair = inspections.filter((i: any) => i.inspection?.status === "in_repair");
  const repaired = inspections.filter((i: any) => i.inspection?.status === "repaired");

  const renderInspectionCard = (order: any) => {
    const inspection = order.inspection;
    const orderIssues = order.issues || [];
    const pendingIssues = orderIssues.filter((issue: InspectionIssue) => issue.status === "pending");
    const approvedIssues = orderIssues.filter((issue: InspectionIssue) => issue.status === "approved" || issue.status === "repaired");
    const isOwner = order.user_id === user?.id;
    const badgeConfig = getInspectionBadge(inspection?.status);
    const allApprovedRepaired = checkAllApprovedRepaired(orderIssues);

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
                      {issue.estimated_cost && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Estimated Cost: <span className="font-medium">£{issue.estimated_cost.toFixed(2)}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported by {issue.requested_by_name}
                      </p>
                    </div>
                    <Badge variant={getIssueBadgeVariant(issue.status)}>
                      {issue.status}
                    </Badge>
                  </div>

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

                  {/* Mark as Repaired Button (admin only for in_repair status, approved issues) */}
                  {isAdmin && inspection?.status === "in_repair" && issue.status === "approved" && (
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

                  {/* Resolve Button (admin only, for issues_found status) */}
                  {isAdmin && inspection?.status === "issues_found" && (issue.status === "approved" || issue.status === "declined") && (
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

          {/* Complete Repairs Button (admin only for in_repair when all approved are repaired) */}
          {isAdmin && inspection?.status === "in_repair" && allApprovedRepaired && (
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
              {isAdmin && inspection?.status === "inspected" && (
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
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="awaiting" className="flex items-center gap-1">
                Awaiting
                {awaitingInspection.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {awaitingInspection.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="no-issues" className="flex items-center gap-1">
                No Issues
                {noIssues.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {noIssues.length}
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
              <TabsTrigger value="in-repair" className="flex items-center gap-1">
                In Repair
                {inRepair.length > 0 && (
                  <Badge variant="warning" className="ml-1">
                    {inRepair.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="repaired" className="flex items-center gap-1">
                Repaired
                {repaired.length > 0 && (
                  <Badge variant="success" className="ml-1">
                    {repaired.length}
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

            <TabsContent value="no-issues" className="space-y-4">
              {noIssues.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes inspected with no issues
                </p>
              ) : (
                noIssues.map(renderInspectionCard)
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

            <TabsContent value="in-repair" className="space-y-4">
              {inRepair.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes currently in repair
                </p>
              ) : (
                inRepair.map(renderInspectionCard)
              )}
            </TabsContent>

            <TabsContent value="repaired" className="space-y-4">
              {repaired.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No repaired bikes
                </p>
              ) : (
                repaired.map(renderInspectionCard)
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
                              placeholder="Estimated cost (£)"
                              value={issue.estimatedCost}
                              onChange={(e) => handleUpdateChecklistIssue(item.id, idx, 'estimatedCost', e.target.value)}
                              className="text-sm"
                            />
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
