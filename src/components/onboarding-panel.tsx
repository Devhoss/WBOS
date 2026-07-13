"use client";

import { ArrowUpRight, Building2, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const DISMISS_KEY = "wbos-onboarding-dismissed";

type Step = {
  label: string;
  done: boolean;
  href: string;
};

function getInitialDismissed(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.onboardingDismissed === "true";
}

export function OnboardingPanel({
  steps,
  doneCount,
  orgName,
}: {
  steps: Step[];
  doneCount: number;
  orgName: string;
}) {
  const [dismissed, setDismissed] = useState(getInitialDismissed);
  const total = steps.length;

  function handleSkip() {
    localStorage.setItem(DISMISS_KEY, "true");
    document.documentElement.dataset.onboardingDismissed = "true";
    setDismissed(true);
  }

  function handleReopen() {
    localStorage.removeItem(DISMISS_KEY);
    document.documentElement.dataset.onboardingDismissed = "false";
    setDismissed(false);
  }

  if (doneCount === total) return null;

  return (
    <>
      <div className="onboarding-expanded rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Getting started</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Set up {orgName} to start operating.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">
              {doneCount}/{total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {steps.map((step) => (
            <Link
              key={step.label}
              href={step.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-muted"
            >
              {step.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {steps.indexOf(step) + 1}
                </span>
              )}
              <span
                className={step.done ? "text-muted-foreground line-through" : ""}
              >
                {step.label}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {steps
            .filter((s) => !s.done)
            .slice(0, 4)
            .map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                {step.label}
                <ArrowUpRight className="size-3" />
              </Link>
            ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleReopen}
        className="onboarding-collapsed flex w-full items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-left text-sm transition hover:bg-muted/60"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-[10px] font-semibold text-primary">{doneCount}</span>
        </span>
        <span className="text-muted-foreground">
          Finish setup &mdash;{" "}
          <span className="font-medium text-foreground">
            {doneCount}/{total}
          </span>{" "}
          complete
        </span>
        <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </>
  );
}
