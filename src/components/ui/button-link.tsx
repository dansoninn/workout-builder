import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

/** A navigation link that looks like a button (a real <a>, so it opens in a new tab, etc.). */
function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return <Link data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { ButtonLink }
