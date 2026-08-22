import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useReviewCycles, useReviewableUsers } from "@/hooks/useReviews";
import NewReviewDialog from "@/components/reviews/NewReviewDialog";
import {
  REVIEW_STAGE_LABELS,
  REVIEW_TYPE_LABELS,
  type ReviewFilters,
  type ReviewStage,
  type ReviewType,
} from "@/types/review";

const stageVariant = (s: ReviewStage) =>
  s === "signed_off" ? "default" : s === "draft" ? "outline" : "secondary";

const ReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: users = [] } = useReviewableUsers();

  const [employeeId, setEmployeeId] = useState("all");
  const [reviewType, setReviewType] = useState<ReviewType | "all">("all");
  const [stage, setStage] = useState<ReviewStage | "all" | "active">("active");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filters: ReviewFilters = useMemo(
    () => ({ employeeId, reviewType, stage, from: from || undefined, to: to || undefined, search }),
    [employeeId, reviewType, stage, from, to, search]
  );

  const { data: reviews = [], isLoading } = useReviewCycles(filters);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Employee Reviews</h1>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New review
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
          <Input placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} />
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={reviewType} onValueChange={v => setReviewType(v as any)}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(REVIEW_TYPE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={v => setStage(v as any)}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">In progress</SelectItem>
              <SelectItem value="all">All stages</SelectItem>
              {Object.entries(REVIEW_STAGE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} title="Period ends on or after" />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} title="Period starts on or before" />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            No reviews match these filters.
          </CardContent></Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {reviews.map(r => (
              <Card
                key={r.id}
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => navigate(`/reviews/${r.id}`)}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.employee?.name || r.employee?.email || "Employee"}</div>
                      <div className="text-xs text-muted-foreground">
                        {REVIEW_TYPE_LABELS[r.review_type]} ·{" "}
                        {new Date(r.period_start).toLocaleDateString("en-GB")} –{" "}
                        {new Date(r.period_end).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    <Badge variant={stageVariant(r.stage)}>{REVIEW_STAGE_LABELS[r.stage]}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Reviewer: {r.reviewer?.name || r.reviewer?.email || "Unassigned"}</span>
                    {r.overall_score !== null && (
                      <span className="font-medium text-foreground">Overall {Number(r.overall_score).toFixed(2)}</span>
                    )}
                    {r.self_overall_score !== null && <span>Self {Number(r.self_overall_score).toFixed(2)}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NewReviewDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultReviewerId={user?.id}
        onCreated={id => navigate(`/reviews/${id}`)}
      />
    </Layout>
  );
};

export default ReviewsPage;
