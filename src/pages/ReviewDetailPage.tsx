import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Lock, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
import {
  useEmployeeRoles,
  usePreviousReview,
  useReviewBundle,
} from "@/hooks/useReviews";
import {
  MANAGER_QUESTIONS,
  SELF_ASSESSMENT_QUESTIONS,
  buildCompetencyGroups,
} from "@/config/reviewCompetencies";
import RatingGrid from "@/components/reviews/RatingGrid";
import type { RatingValue } from "@/components/reviews/RatingRow";
import QuestionList from "@/components/reviews/QuestionList";
import ReviewActionsTable from "@/components/reviews/ReviewActionsTable";
import ReviewHistoryPanel from "@/components/reviews/ReviewHistoryPanel";
import ReviewStageStepper from "@/components/reviews/ReviewStageStepper";
import {
  addAction,
  advanceStage,
  deleteAction,
  deleteReviewCycle,
  recomputeScores,
  reopenReview,
  saveRating,
  saveResponse,
  submitEmployeeResponse,
  updateAction,
  updateReviewCycle,
} from "@/services/reviewService";
import {
  AGREEMENT_LABELS,
  REVIEW_STAGE_LABELS,
  REVIEW_TYPE_LABELS,
  type ReviewAgreement,
  type ReviewStage,
} from "@/types/review";

const EMPLOYEE_RESPONSE_QUESTIONS = [
  { key: "emp_response_detail", label: "Your response to this review" },
  { key: "emp_additional_evidence", label: "Additional evidence you would like recorded" },
];

const ReviewDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, userProfile } = useAuth();

  const { data: bundle, isLoading } = useReviewBundle(id);
  const cycle = bundle?.cycle;
  const { data: employeeRoles = [] } = useEmployeeRoles(cycle?.employee_id);
  const { data: previous } = usePreviousReview(cycle?.employee_id, cycle?.period_start);

  const [notes, setNotes] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<ReviewAgreement | "">("");
  const [empComments, setEmpComments] = useState("");
  const [wantsDiscussion, setWantsDiscussion] = useState(false);

  const isAdmin = hasRole(userProfile, "admin");
  const isReviewer = !!cycle && cycle.reviewer_id === user?.id;
  const isEmployee = !!cycle && cycle.employee_id === user?.id;
  const signedOff = cycle?.stage === "signed_off";
  const canManage = (isAdmin || isReviewer) && !signedOff;

  const groups = useMemo(() => buildCompetencyGroups(employeeRoles), [employeeRoles]);

  const managerRatings = useMemo(() => {
    const map: Record<string, RatingValue> = {};
    (bundle?.ratings ?? []).filter(r => r.source === "manager").forEach(r => {
      map[r.competency_key] = { score: r.score, comment: r.comment };
    });
    return map;
  }, [bundle?.ratings]);

  const selfRatings = useMemo(() => {
    const map: Record<string, RatingValue> = {};
    (bundle?.ratings ?? []).filter(r => r.source === "self").forEach(r => {
      map[r.competency_key] = { score: r.score, comment: r.comment };
    });
    return map;
  }, [bundle?.ratings]);

  const answers = (source: "self" | "manager") => {
    const map: Record<string, string> = {};
    (bundle?.responses ?? []).filter(r => r.source === source).forEach(r => {
      map[r.question_key] = r.answer ?? "";
    });
    return map;
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["review-bundle", id] });
    qc.invalidateQueries({ queryKey: ["review-cycles"] });
    qc.invalidateQueries({ queryKey: ["my-reviews"] });
    qc.invalidateQueries({ queryKey: ["review-history"] });
  };

  const handleRating = async (
    source: "self" | "manager",
    key: string,
    category: "performance" | "behaviour",
    value: RatingValue
  ) => {
    if (!id) return;
    try {
      await saveRating({ cycleId: id, competencyKey: key, category, source, score: value.score, comment: value.comment });
      await recomputeScores(id);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not save that rating");
    }
  };

  const handleAnswer = async (source: "self" | "manager", key: string, answer: string | null) => {
    if (!id) return;
    try {
      await saveResponse({ cycleId: id, questionKey: key, source, answer });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not save that answer");
    }
  };

  const go = async (stage: ReviewStage) => {
    if (!id) return;
    try {
      await advanceStage(id, stage);
      toast.success(`Moved to ${REVIEW_STAGE_LABELS[stage]}`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not move the review on");
    }
  };

  const saveNotes = async () => {
    if (!id || notes === null) return;
    try {
      await updateReviewCycle(id, { meeting_notes: notes });
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not save the notes");
    }
  };

  const submitResponse = async () => {
    if (!id || !agreement) { toast.error("Please choose whether you agree with the review"); return; }
    try {
      await submitEmployeeResponse(id, {
        employee_agreement: agreement,
        employee_comments: empComments.trim() || null,
        employee_requests_discussion: wantsDiscussion,
      });
      toast.success("Response recorded");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not record your response");
    }
  };

  if (isLoading || !cycle) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Loading review…</div>
      </Layout>
    );
  }

  const managerEditable = canManage && (isAdmin || cycle.stage === "manager_assessment");
  const selfEditable = isEmployee && cycle.stage === "self_assessment";
  const actionsEditable = canManage;
  const responseEditable = isEmployee && cycle.stage === "employee_response" && !cycle.employee_acknowledged_at;

  const nextStage: ReviewStage | null = (() => {
    switch (cycle.stage) {
      case "draft": return "self_assessment";
      case "self_assessment": return "manager_assessment";
      case "manager_assessment": return "review_meeting";
      case "review_meeting": return "objectives";
      case "objectives": return "employee_response";
      case "employee_response": return "signed_off";
      default: return null;
    }
  })();

  return (
    <Layout>
      <div className="container mx-auto space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">
                {cycle.employee?.name || cycle.employee?.email || "Employee"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {REVIEW_TYPE_LABELS[cycle.review_type]} review ·{" "}
                {new Date(cycle.period_start).toLocaleDateString("en-GB")} –{" "}
                {new Date(cycle.period_end).toLocaleDateString("en-GB")}
                {cycle.review_date && ` · Meeting ${new Date(cycle.review_date).toLocaleDateString("en-GB")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {signedOff && <Badge className="gap-1"><Lock className="h-3 w-3" /> Signed off</Badge>}
            {isAdmin && signedOff && (
              <Button size="sm" variant="outline" onClick={async () => { await reopenReview(cycle.id); refresh(); }}>
                <Unlock className="mr-1 h-4 w-4" /> Reopen
              </Button>
            )}
            {nextStage && (isAdmin || isReviewer) && !signedOff && (
              <Button size="sm" onClick={() => go(nextStage)}>
                Move to {REVIEW_STAGE_LABELS[nextStage]}
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!confirm("Delete this review permanently?")) return;
                  await deleteReviewCycle(cycle.id);
                  toast.success("Review deleted");
                  navigate("/reviews");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ReviewStageStepper stage={cycle.stage} />

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Overall", value: cycle.overall_score, hint: "70% performance / 30% behaviour" },
            { label: "Performance", value: cycle.performance_score },
            { label: "Behaviour", value: cycle.behaviour_score },
            { label: "Employee self-score", value: cycle.self_overall_score },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-2xl font-semibold">
                  {s.value !== null && s.value !== undefined ? Number(s.value).toFixed(2) : "—"}
                </div>
                {s.hint && <div className="text-[11px] text-muted-foreground">{s.hint}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        {previous?.cycle && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Previous review</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-muted-foreground">
                {REVIEW_TYPE_LABELS[previous.cycle.review_type]} ·{" "}
                {new Date(previous.cycle.period_end).toLocaleDateString("en-GB")} · Overall{" "}
                {previous.cycle.overall_score !== null ? Number(previous.cycle.overall_score).toFixed(2) : "—"}
              </div>
              {previous.actions.length > 0 && (
                <ul className="space-y-1">
                  {previous.actions.map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span>{a.description}</span>
                      <Badge variant={a.status === "complete" ? "default" : "outline"}>
                        {a.status === "complete" ? "Complete" : a.status === "in_progress" ? "In progress" : "Not started"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={isEmployee && !isAdmin && !isReviewer ? "self" : "manager"}>
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="self">Self-assessment</TabsTrigger>
            <TabsTrigger value="manager">Manager assessment</TabsTrigger>
            <TabsTrigger value="meeting">Meeting & objectives</TabsTrigger>
            <TabsTrigger value="response">Employee response</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="self" className="space-y-4 pt-4">
            {cycle.stage === "draft" ? (
              <p className="text-sm text-muted-foreground">
                The self-assessment opens once the review is moved to the self-assessment stage.
              </p>
            ) : (
              <>
                <RatingGrid
                  groups={groups}
                  values={selfRatings}
                  readOnly={!selfEditable}
                  onChange={(key, category, value) => handleRating("self", key, category, value)}
                />
                <QuestionList
                  questions={SELF_ASSESSMENT_QUESTIONS}
                  values={answers("self")}
                  readOnly={!selfEditable}
                  onSave={(key, answer) => handleAnswer("self", key, answer)}
                />
                {selfEditable && (
                  <Button onClick={() => go("manager_assessment")}>Submit self-assessment</Button>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="manager" className="space-y-4 pt-4">
            {!isAdmin && !isReviewer && cycle.stage === "manager_assessment" ? (
              <p className="text-sm text-muted-foreground">
                Your manager is completing their assessment. It will appear here once submitted.
              </p>
            ) : (
              <>
                <RatingGrid
                  groups={groups}
                  values={managerRatings}
                  compare={selfRatings}
                  compareLabel="Self"
                  readOnly={!managerEditable}
                  requireComment
                  onChange={(key, category, value) => handleRating("manager", key, category, value)}
                />
                <QuestionList
                  questions={MANAGER_QUESTIONS}
                  values={answers("manager")}
                  readOnly={!managerEditable}
                  onSave={(key, answer) => handleAnswer("manager", key, answer)}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="meeting" className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label>Review meeting notes</Label>
              {canManage ? (
                <Textarea
                  className="min-h-[120px]"
                  value={notes ?? cycle.meeting_notes ?? ""}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="What was discussed, agreed and raised in the meeting"
                />
              ) : (
                <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm">
                  {cycle.meeting_notes || <span className="text-muted-foreground">No notes recorded</span>}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Agreed objectives and actions</Label>
              <ReviewActionsTable
                actions={bundle?.actions ?? []}
                canEdit={actionsEditable}
                canUpdateStatus={isEmployee}
                onAdd={async a => { await addAction(cycle.id, a); refresh(); }}
                onUpdate={async (aid, updates) => { await updateAction(aid, updates); refresh(); }}
                onDelete={async aid => { await deleteAction(aid); refresh(); }}
              />
            </div>
          </TabsContent>

          <TabsContent value="response" className="space-y-4 pt-4">
            {cycle.employee_acknowledged_at ? (
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="font-medium">
                    {cycle.employee_agreement ? AGREEMENT_LABELS[cycle.employee_agreement] : "Acknowledged"}
                  </div>
                  {cycle.employee_comments && <p className="whitespace-pre-wrap">{cycle.employee_comments}</p>}
                  {cycle.employee_requests_discussion && (
                    <Badge variant="outline">Further discussion requested</Badge>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Acknowledged {new Date(cycle.employee_acknowledged_at).toLocaleString("en-GB")}
                  </div>
                </CardContent>
              </Card>
            ) : responseEditable ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Do you agree with this review?</Label>
                  <Select value={agreement} onValueChange={v => setAgreement(v as ReviewAgreement)}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AGREEMENT_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <QuestionList
                  questions={EMPLOYEE_RESPONSE_QUESTIONS}
                  values={answers("self")}
                  onSave={(key, answer) => handleAnswer("self", key, answer)}
                />
                <div className="space-y-1">
                  <Label>Summary comments</Label>
                  <Textarea value={empComments} onChange={e => setEmpComments(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={wantsDiscussion} onCheckedChange={v => setWantsDiscussion(!!v)} />
                  I would like to request a further discussion
                </label>
                <Button onClick={submitResponse}>
                  Confirm I have read this review
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The employee response opens once the review reaches the employee response stage.
              </p>
            )}
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <ReviewHistoryPanel employeeId={cycle.employee_id} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ReviewDetailPage;
