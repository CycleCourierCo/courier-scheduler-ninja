import React from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyReviews } from "@/hooks/useReviews";
import ReviewHistoryPanel from "@/components/reviews/ReviewHistoryPanel";
import { REVIEW_STAGE_LABELS, REVIEW_TYPE_LABELS } from "@/types/review";

const MyReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useMyReviews(user?.id);

  const actionNeeded = reviews.filter(
    r => r.stage === "self_assessment" || (r.stage === "employee_response" && !r.employee_acknowledged_at)
  );

  return (
    <Layout>
      <div className="container mx-auto space-y-4 px-4 py-6">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">My Reviews</h1>
        </div>

        {actionNeeded.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4 text-sm">
              You have {actionNeeded.length} review{actionNeeded.length > 1 ? "s" : ""} waiting on you.
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your reviews…</p>
        ) : reviews.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            You do not have any reviews yet.
          </CardContent></Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {reviews.map(r => (
              <Card
                key={r.id}
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => navigate(`/reviews/${r.id}`)}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{REVIEW_TYPE_LABELS[r.review_type]} review</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.period_start).toLocaleDateString("en-GB")} –{" "}
                        {new Date(r.period_end).toLocaleDateString("en-GB")}
                      </div>
                    </div>
                    <Badge variant={r.stage === "signed_off" ? "default" : "secondary"}>
                      {REVIEW_STAGE_LABELS[r.stage]}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Reviewer: {r.reviewer?.name || r.reviewer?.email || "Unassigned"}</span>
                    {r.overall_score !== null && (
                      <span className="font-medium text-foreground">Overall {Number(r.overall_score).toFixed(2)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ReviewHistoryPanel employeeId={user?.id} />
      </div>
    </Layout>
  );
};

export default MyReviewsPage;
