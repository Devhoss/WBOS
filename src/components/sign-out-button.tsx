"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { authClient } from "@/infrastructure/auth/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      type="button"
      aria-label="Sign out"
      className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:text-foreground"
      onClick={handleSignOut}
    >
      <LogOut className="size-4" />
    </button>
  );
}
