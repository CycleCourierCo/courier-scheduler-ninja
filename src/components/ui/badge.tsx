
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-1 text-xs font-bold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-status-done text-primary-foreground",
        warning: "border-transparent bg-status-waiting text-foreground",
        progress: "border-transparent bg-status-transit text-primary-foreground",
        active: "border-transparent bg-status-booked text-primary-foreground",
        neutral: "border-transparent bg-status-neutral text-primary-foreground",
        waiting: "border-transparent bg-status-waiting text-foreground",
        booked: "border-transparent bg-status-booked text-primary-foreground",
        transit: "border-transparent bg-status-transit text-primary-foreground",
        done: "border-transparent bg-status-done text-primary-foreground",
        failed: "border-transparent bg-status-failed text-primary-foreground",
        ni: "border-transparent bg-status-ni text-primary-foreground",
        trunk: "border-transparent bg-status-trunk text-primary-foreground",
        inspection: "border-transparent bg-status-inspection text-primary-foreground",
        "p1-segment": "border-transparent bg-segment-1 text-primary-foreground",
        "p2-segment": "border-transparent bg-segment-2 text-primary-foreground",
        "p3-segment": "border-transparent bg-segment-3 text-primary-foreground",
        "p4-segment": "border-transparent bg-segment-4 text-primary-foreground",
        "p5-segment": "border-transparent bg-segment-5 text-primary-foreground",
        "p6-segment": "border-transparent bg-segment-6 text-primary-foreground",
        "p7-segment": "border-transparent bg-segment-7 text-primary-foreground",
        "p8-segment": "border-transparent bg-segment-8 text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

