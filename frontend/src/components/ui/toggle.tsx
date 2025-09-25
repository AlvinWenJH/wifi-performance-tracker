import * as React from "react"
import { cn } from "@/lib/utils"

export interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  size?: "sm" | "default" | "lg"
  variant?: "default" | "outline"
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed = false, onPressedChange, size = "default", variant = "default", onClick, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onPressedChange?.(!pressed)
      onClick?.(event)
    }

    const sizeClasses = {
      sm: "h-5 w-9",
      default: "h-6 w-11", 
      lg: "h-7 w-13"
    }

    const thumbSizeClasses = {
      sm: "h-4 w-4",
      default: "h-5 w-5",
      lg: "h-6 w-6"
    }

    const translateClasses = {
      sm: pressed ? "translate-x-4" : "translate-x-0",
      default: pressed ? "translate-x-5" : "translate-x-0",
      lg: pressed ? "translate-x-6" : "translate-x-0"
    }

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={pressed}
        onClick={handleClick}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses[size],
          pressed 
            ? "bg-primary" 
            : variant === "outline" 
              ? "bg-input border-border" 
              : "bg-input",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out",
            thumbSizeClasses[size],
            translateClasses[size]
          )}
        />
      </button>
    )
  }
)

Toggle.displayName = "Toggle"

export { Toggle }