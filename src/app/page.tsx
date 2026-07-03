import { Activity, AlertTriangle, CheckCircle2, Database, FileClock, Shield } from "lucide-react";

import { AppShell } from "@/components/app-shell";

const foundationItems = [
  {
    title: "Authentication Boundary",
    description: "Better Auth is wired through a dedicated infrastructure module.",
    icon: Shield,
    status: "Ready for configuration",
  },
  {
    title: "Organization Context",
    description: "Every authenticated request resolves an Organization before touching business data.",
    icon: CheckCircle2,
    status: "Tenant aware",
  },
  {
    title: "Database Foundation",
    description: "Prisma models cover identity, settings, activity logs, attachments, and document sequences.",
    icon: Database,
    status: "Migration ready",
  },
  {
    title: "Activity Logging",
    description: "Business events have an append-only repository and service foundation.",
    icon: Activity,
    status: "Service ready",
  },
  {
    title: "Storage Abstraction",
    description: "Files pass through a provider interface with local storage as the initial backend.",
    icon: FileClock,
    status: "Local provider",
  },
  {
    title: "Business Workflows",
    description: "Master data, inventory, purchasing, sales, and payments remain intentionally deferred.",
    icon: AlertTriangle,
    status: "Phase 2+",
  },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              WBOS is ready for the Phase 1 platform work: authentication, tenancy,
              database migrations, storage, activity logging, and the application shell.
            </p>
          </div>
          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            Base currency: <span className="font-medium text-foreground">KWD</span>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {foundationItems.map((item) => (
            <article key={item.title} className="rounded-lg border bg-background p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                  <item.icon className="size-5 text-primary" />
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {item.status}
                </span>
              </div>
              <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
