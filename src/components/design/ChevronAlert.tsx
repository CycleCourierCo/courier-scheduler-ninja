import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const ChevronAlert = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("chevron-tape flex gap-3", className)} role="status" {...props}>
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
    <div>{children}</div>
  </div>
);

export default ChevronAlert;