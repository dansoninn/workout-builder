import type { Metadata } from "next";

import { AuthHeading, SwitchLink } from "@/components/auth/auth-page";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <AuthHeading title="Sign in">Welcome back.</AuthHeading>
      <SignInForm />
      <p className="mt-6 text-muted-foreground">
        New here? <SwitchLink page="/sign-up">Create an account</SwitchLink>
      </p>
    </>
  );
}
