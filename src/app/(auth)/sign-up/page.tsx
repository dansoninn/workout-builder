import type { Metadata } from "next";

import { AuthHeading, SwitchLink } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Create an account">
        Then create your gym, or open the invitation link you were sent.
      </AuthHeading>
      <SignUpForm />
      <p className="mt-6 text-muted-foreground">
        Already have an account? <SwitchLink page="/sign-in">Sign in</SwitchLink>
      </p>
    </>
  );
}
