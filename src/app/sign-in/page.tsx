import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth-card";
import { auth } from "@/infrastructure/auth/auth";

import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user.id) {
    redirect("/");
  }

  return (
    <AuthCard
      title="Sign in"
      description="Access the WBOS operating shell with your email and password."
      footer={{ text: "New to WBOS?", label: "Create an account", href: "/sign-up" }}
    >
      <SignInForm />
    </AuthCard>
  );
}
