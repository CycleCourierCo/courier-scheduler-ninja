import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wrench, CheckCircle, AlertTriangle, MessageSquare, Loader2, RotateCcw } from "lucide-react";
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
} from "@/services/inspectionService";
import { InspectionIssue } from "@/types/inspection";

const BicycleInspections = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = userProfile?.role === "admin";

  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [customerResponses, setCustomerResponses] = useState<Record<string, string>>({});

  // Fetch inspections based on role
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["bicycle-inspections", isAdmin, user?.id],
    queryFn: async () => {
      if (isAdmin) {
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
    mutationFn: async (orderId: string) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }
      return markAsInspected(orderId, user.id, userProfile.name || user.email || "Admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      toast.success("Bike marked as inspected");
    },
    onError: (error) => {
      toast.error("Failed to mark as inspected");
      console.error(error);
    },
  });

  // Add issue mutation
  const addIssueMutation = useMutation({
    mutationFn: async ({ orderId, description, cost }: { orderId: string; description: string; cost: number | null }) => {
      if (!user?.id || !userProfile?.name) {
        throw new Error("User not authenticated");
      }
      return addInspectionIssue(orderId, description, cost, user.id, userProfile.name || user.email || "Admin");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bicycle-inspections"] });
      setIssueDialogOpen(false);
      setIssueDescription("");
      setEstimatedCost("");
      setSelectedOrderId(null);
      toast.success("Issue reported successfully");
    },
    onError: (error) => {
      toast.error("Failed to report issue");
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

  const handleSubmitIssue = () => {
    if (!selectedOrderId || !issueDescription.trim()) {
      toast.error("Please provide issue details");
      return;
    }
    const cost = estimatedCost ? parseFloat(estimatedCost) : null;
    addIssueMutation.mutate({ orderId: selectedOrderId, description: issueDescription, cost });
  };

  // Filter inspections by status
  const awaitingInspection = inspections.filter((i: any) => !i.inspection || i.inspection.status === "pending");
  const inspected = inspections.filter((i: any) => i.inspection?.status === "inspected");
  const withIssues = inspections.filter((i: any) => i.inspection?.status === "issues_found");

  const renderInspectionCard = (order: any) => {
    const inspection = order.inspection;
    const issues = order.issues || [];
    const pendingIssues = issues.filter((issue: InspectionIssue) => issue.status === "pending");
    const isOwner = order.user_id === user?.id;

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
            </div>
            <Badge
              variant={
                inspection?.status === "inspected"
                  ? "success"
                  : inspection?.status === "issues_found"
                  ? "destructive"
                  : "secondary"
              }
            >
              {inspection?.status === "inspected"
                ? "Inspected"
                : inspection?.status === "issues_found"
                ? "Issues Found"
                : "Awaiting Inspection"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Issues Section */}
          {issues.length > 0 && (
            <div className="space-y-3">
              {issues.map((issue: InspectionIssue) => (
                <div
                  key={issue.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    issue.status === "resolved"
                      ? "bg-green-50 dark:bg-green-950 border-green-500"
                      : "bg-amber-50 dark:bg-amber-950 border-amber-500"
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
                    <Badge variant={issue.status === "resolved" ? "success" : "warning"}>
                      {issue.status}
                    </Badge>
                  </div>

                  {/* Customer Response */}
                  {issue.customer_response && (
                    <div className="mt-3 p-2 bg-background rounded border">
                      <p className="text-xs text-muted-foreground mb-1">Customer Response:</p>
                      <p className="text-sm">{issue.customer_response}</p>
                    </div>
                  )}

                  {/* Response Form (for customers) */}
                  {!isAdmin && isOwner && issue.status === "pending" && !issue.customer_response && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Enter your response..."
                        value={customerResponses[issue.id] || ""}
                        onChange={(e) =>
                          setCustomerResponses((prev) => ({
                            ...prev,
                            [issue.id]: e.target.value,
                          }))
                        }
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          const response = customerResponses[issue.id];
                          if (response?.trim()) {
                            submitResponseMutation.mutate({ issueId: issue.id, response });
                          }
                        }}
                        disabled={!customerResponses[issue.id]?.trim() || submitResponseMutation.isPending}
                      >
                        {submitResponseMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <MessageSquare className="h-4 w-4 mr-1" />
                        )}
                        Submit Response
                      </Button>
                    </div>
                  )}

                  {/* Resolve Button (admin only) */}
                  {isAdmin && issue.status === "pending" && issue.customer_response && (
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

          {/* Admin Actions */}
          {isAdmin && (!inspection || inspection.status === "pending") && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => markInspectedMutation.mutate(order.id)}
                disabled={markInspectedMutation.isPending}
              >
                {markInspectedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Mark Inspected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleOpenIssueDialog(order.id)}>
                <AlertTriangle className="h-4 w-4 mr-1" />
                Report Issue
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
            <TabsList>
              <TabsTrigger value="awaiting" className="flex items-center gap-1">
                Awaiting
                {awaitingInspection.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {awaitingInspection.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inspected" className="flex items-center gap-1">
                Inspected
                {inspected.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {inspected.length}
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

            <TabsContent value="inspected" className="space-y-4">
              {inspected.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No inspected bikes
                </p>
              ) : (
                inspected.map(renderInspectionCard)
              )}
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              {withIssues.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No bikes with issues
                </p>
              ) : (
                withIssues.map(renderInspectionCard)
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Issue Dialog */}
        <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Report Issue
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>What's wrong with the bike?</Label>
                <Textarea
                  placeholder="Describe the issue..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Repair Cost (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 45.00"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitIssue} disabled={addIssueMutation.isPending}>
                {addIssueMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-1" />
                )}
                Report Issue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BicycleInspections;
