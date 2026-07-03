import { AppShell } from "@/components/app-shell";

type PhasePlaceholderPageProps = {
  title: string;
  description: string;
};

export function PhasePlaceholderPage({ title, description }: PhasePlaceholderPageProps) {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
    </AppShell>
  );
}
