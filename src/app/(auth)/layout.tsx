import Link from "next/link";

import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/theme";

/** Signed-out pages: one narrow column, nothing else to look at. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="rounded-sm">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 justify-center px-4 pt-[8vh] pb-16 sm:pt-[12vh]">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
