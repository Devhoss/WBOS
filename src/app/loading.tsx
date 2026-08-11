export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded bg-muted" />
          <div className="h-4 w-52 rounded bg-muted" />
        </div>
      </div>

      {/* Operations KPIs */}
      <section className="space-y-3">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-md bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
              </div>
              <div className="mt-4 h-7 w-20 rounded bg-muted" />
              <div className="mt-1 h-4 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>

      {/* Financial KPIs */}
      <section className="mt-6 space-y-3">
        <div className="h-3 w-16 rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-background p-5">
              <div className="flex items-center justify-between">
                <div className="size-10 rounded-md bg-muted" />
              </div>
              <div className="mt-4 h-7 w-24 rounded bg-muted" />
              <div className="mt-1 h-4 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border">
          <div className="border-b px-5 py-4">
            <div className="h-4 w-32 rounded bg-muted" />
          </div>
          <div className="p-4">
            <div className="h-40 w-full rounded bg-muted" />
          </div>
        </section>
        <section className="rounded-lg border">
          <div className="border-b px-5 py-4">
            <div className="h-4 w-28 rounded bg-muted" />
          </div>
          <div className="p-4">
            <div className="h-40 w-full rounded bg-muted" />
          </div>
        </section>
      </div>
    </div>
  );
}
