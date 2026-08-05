"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { getWholesaleTerm, type WholesaleTermKey } from "@/lib/wholesale-terms";

export function HelpTooltip({ term }: { term: WholesaleTermKey }) {
  const [open, setOpen] = useState(false);
  const entry = getWholesaleTerm(term);

  if (!entry) return null;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`What does "${entry.term}" mean?`}
        className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="size-3.5" />
      </button>

      {open ? (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-[9999] mt-2 w-[300px] -translate-x-1/2 rounded-lg border border-border bg-background px-3 py-2.5 text-left shadow-lg"
        >
          <span className="block font-semibold text-sm text-foreground">{entry.term}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {entry.definition}
          </span>
        </span>
      ) : null}
    </span>
  );
}

export function TermLabel({
  term,
  children,
}: {
  term: WholesaleTermKey;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <HelpTooltip term={term} />
    </span>
  );
}
