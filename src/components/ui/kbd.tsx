import { cn } from "cn"

// Keyboard keys (docs/DESIGN.md): shown next to every action that has a shortcut.
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-0.5 rounded-sm border border-border-strong bg-surface-sunken px-1 font-sans text-2xs font-medium text-muted-foreground select-none in-data-[slot=tooltip-content]:border-transparent in-data-[slot=tooltip-content]:bg-background/15 in-data-[slot=tooltip-content]:text-background [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
