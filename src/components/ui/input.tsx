import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

// Inputs (docs/DESIGN.md): 32 px, border meets 3:1 non-text contrast, focus
// shows a coloured border plus a soft ring instead of the offset outline.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-surface px-2.5 text-sm text-foreground transition-[border-color,box-shadow] duration-100 placeholder:text-subtle-foreground file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--destructive)_22%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
