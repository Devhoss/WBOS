import Link from "next/link";
import { formatStatus } from "@/components/status-colors";

type RelatedDoc = {
  href: string;
  label: string;
  subtitle?: string;
  status?: string;
  amount?: number;
};

export function RelatedDocuments({ title, documents }: { title?: string; documents: RelatedDoc[] }) {
  if (documents.length === 0) return null;
  return (
    <section className="rounded-lg border p-5">
      {title && <h2 className="text-sm font-semibold mb-3">{title}</h2>}
      <div className="space-y-2">
        {documents.map((doc, i) => (
          <Link
            key={`${doc.href}-${i}`}
            href={doc.href}
            className="flex items-center justify-between rounded-md border p-3 text-sm transition hover:bg-muted/30"
          >
            <div>
              <span className="font-medium">{doc.label}</span>
              {doc.subtitle && <span className="ml-2 text-xs text-muted-foreground">{doc.subtitle}</span>}
            </div>
            <div className="flex items-center gap-2">
              {doc.status && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  doc.status === "ISSUED" || doc.status === "PAID" || doc.status === "COMPLETED" || doc.status === "DELIVERED"
                    ? "bg-green-100 text-green-800"
                    : doc.status === "CANCELLED" || doc.status === "FAILED"
                    ? "bg-red-100 text-red-600"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {formatStatus(doc.status)}
                </span>
              )}
              {doc.amount !== undefined && (
                <span className="font-mono tabular-nums text-muted-foreground">{doc.amount.toFixed(3)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
