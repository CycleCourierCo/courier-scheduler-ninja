import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { REVIEW_STAGE_LABELS, REVIEW_STAGE_ORDER, type ReviewStage } from "@/types/review";

interface Props {
  stage: ReviewStage;
}

const ReviewStageStepper: React.FC<Props> = ({ stage }) => {
  const currentIndex = REVIEW_STAGE_ORDER.indexOf(stage);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {REVIEW_STAGE_ORDER.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div
            key={s}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              active && "border-primary bg-primary/10 text-primary font-medium",
              done && "border-muted bg-muted text-muted-foreground",
              !active && !done && "border-dashed text-muted-foreground"
            )}
          >
            {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{i + 1}</span>}
            {REVIEW_STAGE_LABELS[s]}
          </div>
        );
      })}
    </div>
  );
};

export default ReviewStageStepper;
