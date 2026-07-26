import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ReturnOrderService } from "@/domains/returns/services/return-order-service";
import { AuthenticatedRequestContextService } from "@/infrastructure/request/authenticated-request-context";

export const metadata: Metadata = { title: "Returns" };

const statusBadge: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function ReturnsPage() {
  const context = await new AuthenticatedRequestContextService().getCurrentContext();
  const result = await new ReturnOrderService().list(context.organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="border-b pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Returns</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Customer returns and credit processing.
              </p>
            </div>
            <Link
              href="/returns/new"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              New Return
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Return #</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Lines</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">By</th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No returns yet.
                  </td>
                </tr>
              ) : (
                result.data.map((r) => (
                  <tr key={r.id} className="border-b transition hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/returns/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.returnNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.customer.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {r.reason?.toLowerCase().replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.lines.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.createdBy?.name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
