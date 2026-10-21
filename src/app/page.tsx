import { Logo } from "@/components/app/logo";
import { ButtonLink } from "@/components/ui/button-link";

/**
 * `/` is redirected by the proxy (sign in, create your gym, or your last
 * gym). This page only shows if that redirect could not run.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-background px-4 pt-[16vh]">
      <div className="grid w-full max-w-sm gap-4">
        <Logo />
        <p className="text-muted-foreground">Programming and training-load tracking for functional fitness gyms.</p>
        <ButtonLink href="/sign-in" className="w-fit">
          Continue
        </ButtonLink>
      </div>
    </main>
  );
}
