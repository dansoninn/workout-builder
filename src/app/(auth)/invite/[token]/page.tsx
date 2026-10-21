import type { Metadata } from "next";
import { Suspense } from "react";

import { signOut } from "@/app/(auth)/actions";
import { AuthHeading } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
import { authPath } from "@/lib/paths";
import { roleLabel } from "@/lib/permissions";
import { getCurrentUser, getMyGyms } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Invitation", referrer: "no-referrer" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <Invitation params={params} />
    </Suspense>
  );
}

async function Invitation({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  const path = `/invite/${token}`;

  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([
    /^[0-9a-f]{64}$/.test(token) ? supabase.rpc("invitation_preview", { p_token: token }) : Promise.resolve({ data: [] }),
    getCurrentUser(),
  ]);
  const invite = data?.[0];

  if (!invite) {
    return (
      <Message title="This invitation link is not valid">
        Check that you copied the whole link, or ask the gym&apos;s owner to send a new one.
      </Message>
    );
  }

  const role = roleLabel(invite.role);
  const gyms = user ? await getMyGyms() : [];
  const alreadyMember = gyms.find((g) => g.slug === invite.gym_slug);

  if (alreadyMember) {
    return (
      <Message title={`You're already in ${invite.gym_name}`}>
        <ButtonLink href={`/${invite.gym_slug}/builder`} size="lg" className="mt-2 w-full">
          Open {invite.gym_name}
        </ButtonLink>
      </Message>
    );
  }

  if (invite.status !== "open") {
    const reason = {
      accepted: "This invitation has already been used.",
      cancelled: "This invitation was cancelled or replaced by a newer link.",
      expired: "This invitation has expired. Links work for 14 days.",
    }[invite.status];
    return (
      <Message title={`Invitation to ${invite.gym_name}`}>
        {reason} Ask the gym&apos;s owner to send you a new link.
      </Message>
    );
  }

  if (!user) {
    return (
      <>
        <AuthHeading title={`Join ${invite.gym_name}`}>
          You&apos;re invited as <strong className="font-medium text-foreground">{role}</strong>. Create your account to
          join.
        </AuthHeading>
        <SignUpForm invitedEmail={invite.email} next={path} submitLabel="Create account and join" />
        <p className="mt-6 text-muted-foreground">
          Already have an account?{" "}
          <ButtonLink href={authPath("/sign-in", path)} variant="link" className="font-medium">
            Sign in to join
          </ButtonLink>
        </p>
      </>
    );
  }

  if (!invite.email_matches) {
    return (
      <Message title={`Join ${invite.gym_name}`}>
        <p>
          This invitation is for <strong className="font-medium text-foreground">{invite.email}</strong>, but you&apos;re
          signed in as <strong className="font-medium text-foreground">{user.email}</strong>.
        </p>
        <form action={signOut} className="mt-4">
          <input type="hidden" name="next" value={path} />
          <Button type="submit" variant="outline" size="lg" className="w-full">
            Sign out and use {invite.email}
          </Button>
        </form>
      </Message>
    );
  }

  return (
    <>
      <AuthHeading title={`Join ${invite.gym_name}`}>
        You&apos;re invited as <strong className="font-medium text-foreground">{role}</strong>.
      </AuthHeading>
      <JoinForm token={token} gymName={invite.gym_name} />
    </>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <AuthHeading title={title} />
      <div className="-mt-3 text-muted-foreground">{children}</div>
    </>
  );
}

function InviteSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading the invitation">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="mt-4 h-9 w-full" />
    </div>
  );
}
