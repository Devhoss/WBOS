"use client";

import { Component, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-destructive/30 bg-background p-8 text-center">
            <TriangleAlert className="mx-auto mb-3 size-8 text-destructive" />
            <p className="text-sm font-semibold">Failed to load dashboard data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Something went wrong while fetching your data. Please try again.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
