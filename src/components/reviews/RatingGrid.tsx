import React from "react";
import RatingRow, { type RatingValue } from "./RatingRow";
import type { CompetencyGroup } from "@/config/reviewCompetencies";

interface Props {
  groups: CompetencyGroup[];
  values: Record<string, RatingValue>;
  compare?: Record<string, RatingValue>;
  compareLabel?: string;
  readOnly?: boolean;
  requireComment?: boolean;
  onChange: (key: string, category: "performance" | "behaviour", value: RatingValue) => void;
}

const RatingGrid: React.FC<Props> = ({
  groups, values, compare, compareLabel, readOnly, requireComment, onChange,
}) => (
  <div className="space-y-5">
    {groups.map(group => (
      <div key={group.label} className="space-y-2">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {group.label}
        </h4>
        <div className="space-y-2">
          {group.items.map(c => (
            <RatingRow
              key={c.key}
              competency={c}
              value={values[c.key] ?? { score: null, comment: null }}
              compareScore={compare?.[c.key]?.score ?? null}
              compareLabel={compareLabel}
              readOnly={readOnly}
              requireComment={requireComment}
              onChange={v => onChange(c.key, c.category, v)}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default RatingGrid;
