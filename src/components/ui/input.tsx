
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // If it's a phone input with a fixed prefix
    if (type === "tel" && props.value && String(props.value).startsWith('+44')) {
      // Create a styled prefix span and modified input for phone numbers
      return (
        <div className="flex h-10 w-full rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <span className="flex items-center px-3 text-base text-foreground select-none md:text-sm">+44</span>
          <input
            type={type}
            className={cn(
              "flex-1 h-full border-0 bg-transparent px-0 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            )}
            ref={ref}
            value={String(props.value).substring(3)} // Remove the +44 prefix from the input value
            onChange={(e) => {
              // Add the prefix back when sending to the onChange handler
              if (props.onChange) {
                const syntheticEvent = {
                  ...e,
                  target: {
                    ...e.target,
                    value: '+44' + e.target.value
                  }
                } as React.ChangeEvent<HTMLInputElement>;
                props.onChange(syntheticEvent);
              }
            }}
            {...props}
            // Remove the original value and onChange props to avoid conflicts
            value={undefined}
            onChange={undefined}
          />
        </div>
      )
    }
    
    // Default input rendering for non-phone inputs
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
