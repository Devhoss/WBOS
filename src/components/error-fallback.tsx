"use client";

import { AlertTriangle } from "lucide-react";

export function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <h3 className="mt-4 text-base font-semibold">Something went wrong</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Try refreshing the page."}
      </p>
    </div>
  );
}
