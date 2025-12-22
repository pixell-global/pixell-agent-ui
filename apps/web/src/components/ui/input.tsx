import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md bg-white/[0.06] border border-white/10 px-3 py-1 text-base text-white placeholder:text-white/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pixell-yellow/50 focus:border-pixell-yellow/50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white/90 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
