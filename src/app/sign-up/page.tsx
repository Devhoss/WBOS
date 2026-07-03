import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth-card";
import { auth } from "@/infrastructure/auth/auth";

import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user.id) {
    redirect("/");
  }

  return (
    <AuthCard
      title="Create account"
      description="Register the first owner account and create the initial organization."
      footer={{ text: "Already have an account?", label: "Sign in", href: "/sign-in" }}
    >
      <SignUpForm />
    </AuthCard>
  );
}
