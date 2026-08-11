export function ExecutiveSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Panel 1 skeleton */}
      <section className="space-y-4">
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
              <div className="size-10 rounded-md bg-muted" />
              <div className="mt-4 h-7 w-32 rounded bg-muted" />
              <div className="mt-2 h-4 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-background">
            <div className="border-b px-5 py-4"><div className="h-4 w-32 rounded bg-muted" /></div>
            <div className="p-4"><div className="h-48 rounded bg-muted/50" /></div>
          </div>
          <div className="rounded-lg border bg-background">
            <div className="border-b px-5 py-4"><div className="h-4 w-40 rounded bg-muted" /></div>
            <div className="p-4"><div className="h-48 rounded bg-muted/50" /></div>
          </div>
        </div>
      </section>

      {/* Panel 2 skeleton */}
      <section className="space-y-4">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
              <div className="size-10 rounded-md bg-muted" />
              <div className="mt-4 h-7 w-32 rounded bg-muted" />
              <div className="mt-2 h-4 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="h-3 w-24 rounded bg-muted mb-3" />
          <div className="h-3 w-full rounded-full bg-muted" />
          <div className="mt-3 flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-muted" />
                <div className="h-3 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-background">
          <div className="border-b px-5 py-4"><div className="h-4 w-40 rounded bg-muted" /></div>
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="h-3.5 w-32 rounded bg-muted" />
                <div className="flex-1" />
                <div className="h-3.5 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Panel 3 skeleton */}
      <section className="space-y-4">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
              <div className="size-10 rounded-md bg-muted" />
              <div className="mt-4 h-7 w-28 rounded bg-muted" />
              <div className="mt-2 h-4 w-36 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>

      {/* Panel 4 skeleton */}
      <section className="space-y-4">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
              <div className="size-10 rounded-md bg-muted" />
              <div className="mt-4 h-7 w-24 rounded bg-muted" />
              <div className="mt-2 h-4 w-32 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>

      {/* Panel 5 skeleton */}
      <section className="space-y-4">
        <div className="h-4 w-44 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-4 sm:p-5">
              <div className="size-10 rounded-md bg-muted" />
              <div className="mt-4 h-7 w-32 rounded bg-muted" />
              <div className="mt-2 h-4 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
