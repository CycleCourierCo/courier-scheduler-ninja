import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ValidationBadgeProps {
  passed: boolean;
  fallbackUsed: boolean;
  errors?: string[];
}

const ValidationBadge: React.FC<ValidationBadgeProps> = ({ passed, fallbackUsed, errors = [] }) => {
  if (passed && !fallbackUsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="success" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              AI Validated
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>AI allocation passed all validation checks</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (fallbackUsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Fallback Used
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium mb-1">AI allocation failed validation, heuristic fallback applied</p>
            {errors.length > 0 && (
              <ul className="text-xs space-y-0.5">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
                {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Validation Failed
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <ul className="text-xs space-y-0.5">
            {errors.slice(0, 5).map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ValidationBadge;
