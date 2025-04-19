
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
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
        success: "border-transparent bg-green-500 text-white",
        warning: "border-transparent bg-amber-500 text-white",
        progress: "border-transparent bg-courier-200 text-courier-800",
        active: "border-transparent bg-courier-600 text-white",
        // New polygon segment color variants
        "p1-segment": "border-transparent bg-[#8B5CF6] text-white", // Vivid Purple
        "p2-segment": "border-transparent bg-[#F97316] text-white", // Bright Orange
        "p3-segment": "border-transparent bg-[#0EA5E9] text-white", // Ocean Blue
        "p4-segment": "border-transparent bg-[#10B981] text-white", // Soft Green
        "p5-segment": "border-transparent bg-[#F43F5E] text-white", // Soft Pink
        "p6-segment": "border-transparent bg-[#14B8A6] text-white", // Teal
        "p7-segment": "border-transparent bg-[#6366F1] text-white", // Indigo
        "p8-segment": "border-transparent bg-[#EC4899] text-white", // Pink
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

