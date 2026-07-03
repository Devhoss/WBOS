import { Building2 } from "lucide-react";
import Link from "next/link";

export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: {
    label: string;
    href: string;
    text: string;
  };
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">WBOS</p>
            <p className="text-xs text-muted-foreground">Wholesale operations</p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <div className="mt-6">{children}</div>

        <p className="mt-6 text-sm text-muted-foreground">
          {footer.text}{" "}
          <Link className="font-medium text-primary hover:underline" href={footer.href}>
            {footer.label}
          </Link>
        </p>
      </section>
    </main>
  );
}
