import { Check } from "lucide-react";
import { CLAIM_STEPS, canonicalStep, stepIndex, type ClaimStatus } from "@/services/claimsService";
import { cn } from "@/lib/utils";

interface Props {
  status: ClaimStatus;
}

const ClaimStepper = ({ status }: Props) => {
  const isRejected = status === "rejected";
  const currentIdx = isRejected ? -1 : stepIndex(status);
  const canonical = canonicalStep(status);

  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex items-center min-w-max gap-1 py-2">
        {CLAIM_STEPS.map((s, i) => {
          const done = !isRejected && i < currentIdx;
          const current = !isRejected && s.value === canonical;
          return (
            <li key={s.value} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold",
                    done && "bg-primary border-primary text-primary-foreground",
                    current && "bg-primary/10 border-primary text-primary",
                    !done && !current && "border-muted-foreground/30 text-muted-foreground bg-background",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div
                  className={cn(
                    "mt-1 text-[10px] sm:text-xs whitespace-nowrap max-w-[110px] text-center",
                    current ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </div>
              </div>
              {i < CLAIM_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 sm:w-12 mx-1",
                    i < currentIdx ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      {isRejected && (
        <div className="text-xs text-destructive font-medium px-1 pb-1">Claim rejected</div>
      )}
    </div>
  );
};

export default ClaimStepper;
