import React, { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RATING_LABELS } from "@/types/review";
import type { Competency } from "@/config/reviewCompetencies";

export interface RatingValue {
  score: number | null;
  comment: string | null;
}

interface Props {
  competency: Competency;
  value: RatingValue;
  readOnly?: boolean;
  /** Manager ratings require a comment for 1, 2, 4, 5 */
  requireComment?: boolean;
  onChange: (value: RatingValue) => void;
  /** Optional counterpart score to display next to the input (e.g. self score) */
  compareScore?: number | null;
  compareLabel?: string;
}

const scoreColour = (score: number) => {
  if (score <= 2) return "bg-destructive text-destructive-foreground border-destructive";
  if (score === 3) return "bg-muted text-foreground border-border";
  return "bg-primary text-primary-foreground border-primary";
};

const RatingRow: React.FC<Props> = ({
  competency, value, readOnly, requireComment, onChange, compareScore, compareLabel,
}) => {
  const [comment, setComment] = useState(value.comment ?? "");

  useEffect(() => { setComment(value.comment ?? ""); }, [value.comment]);

  const needsComment =
    !!requireComment && value.score !== null && value.score !== 3 && !comment.trim();

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">{competency.label}</div>
          {competency.description && (
            <div className="text-xs text-muted-foreground">{competency.description}</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {typeof compareScore === "number" && (
            <Badge variant="outline" className="mr-1 text-xs">
              {compareLabel ?? "Self"}: {compareScore}
            </Badge>
          )}
          {[1, 2, 3, 4, 5].map(n => (
            <Button
              key={n}
              type="button"
              size="icon"
              variant="outline"
              disabled={readOnly}
              title={RATING_LABELS[n]}
              className={cn("h-8 w-8 text-xs", value.score === n && scoreColour(n))}
              onClick={() => onChange({ score: value.score === n ? null : n, comment })}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {value.score !== null && (
        <div className="mt-1 text-xs text-muted-foreground">{RATING_LABELS[value.score]}</div>
      )}

      {readOnly ? (
        value.comment ? <p className="mt-2 whitespace-pre-wrap text-sm">{value.comment}</p> : null
      ) : (
        <>
          <Textarea
            className={cn("mt-2 min-h-[60px] text-sm", needsComment && "border-destructive")}
            placeholder={
              requireComment
                ? "Evidence / explanation (required for 1, 2, 4 and 5)"
                : "Comments (optional)"
            }
            value={comment}
            onChange={e => setComment(e.target.value)}
            onBlur={() => onChange({ score: value.score, comment: comment.trim() || null })}
          />
          {needsComment && (
            <p className="mt-1 text-xs text-destructive">
              A written explanation is required for this score.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default RatingRow;
