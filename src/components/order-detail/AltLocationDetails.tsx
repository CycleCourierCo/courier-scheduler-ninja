import React from "react";
import { Briefcase, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AltLocation,
  describeWindows,
  formatAltAddress,
  hasWorkAddress,
} from "@/lib/altLocation";

interface AltLocationDetailsProps {
  type: "sender" | "receiver";
  alt?: AltLocation | null;
}

const formatDateKey = (key: string): string => {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const AltLocationDetails: React.FC<AltLocationDetailsProps> = ({ type, alt }) => {
  if (!alt) return null;

  const hasWork = hasWorkAddress(alt);
  const neighbour = alt.neighbour_number?.trim();
  if (!hasWork && !neighbour) return null;

  const label = type === "sender" ? "Alternative collection details" : "Alternative delivery details";
  const verb = type === "sender" ? "Collect" : "Deliver";

  const dateEntries = Object.entries(alt.work_dates || {}).sort(([a], [b]) => a.localeCompare(b));
  const legacyWindows = describeWindows(alt.work_windows);

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-amber-900">{label}</p>
        {hasWork && (
          <Badge variant="outline" className="border-amber-400 text-amber-900">
            Work address
          </Badge>
        )}
        {neighbour && (
          <Badge variant="outline" className="border-amber-400 text-amber-900">
            Neighbour
          </Badge>
        )}
      </div>

      {hasWork && (
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <Briefcase className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">{verb} from work address:</p>
            <p className="break-words">{formatAltAddress(alt.work_address)}</p>
            {dateEntries.length > 0 ? (
              <ul className="space-y-0.5">
                {dateEntries.map(([key, window]) => (
                  <li key={key}>
                    {formatDateKey(key)}: {window.start}–{window.end}
                  </li>
                ))}
              </ul>
            ) : legacyWindows ? (
              <p>{legacyWindows}</p>
            ) : (
              <p className="text-amber-800">No times given — check with the customer.</p>
            )}
          </div>
        </div>
      )}

      {neighbour && (
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <Users className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Can be left with the neighbour at number <span className="font-medium">{neighbour}</span>.
          </p>
        </div>
      )}
    </div>
  );
};

export default AltLocationDetails;
