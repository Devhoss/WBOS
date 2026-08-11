export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Hero metrics skeleton */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="size-10 rounded-md bg-muted" />
            </div>
            <div className="mt-4 h-7 w-32 rounded bg-muted" />
            <div className="mt-2 h-4 w-28 rounded bg-muted" />
          </div>
        ))}
      </section>

      {/* Pipeline skeleton */}
      <section className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-5 w-8 rounded bg-muted" />
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-muted" />
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-3 w-6 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Charts skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <div className="h-4 w-36 rounded bg-muted" />
          </div>
          <div className="p-4">
            <div className="h-48 rounded bg-muted/50" />
          </div>
        </div>
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4">
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
          <div className="p-4">
            <div className="h-48 rounded bg-muted/50" />
          </div>
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-background lg:col-span-2">
          <div className="border-b px-5 py-4">
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5 size-4 rounded bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-6">
          <div className="rounded-lg border bg-background">
            <div className="border-b px-5 py-4">
              <div className="h-4 w-32 rounded bg-muted" />
            </div>
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-3 w-12 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-background">
            <div className="border-b px-5 py-4">
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="h-3.5 w-24 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
