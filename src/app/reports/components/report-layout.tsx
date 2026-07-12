import { cn } from "@/lib/utils";

type ReportLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function ReportLayout({ title, description, children, actions }: ReportLayoutProps) {
  return (
    <div className="space-y-6">
      <div className={cn("flex flex-col gap-4", actions && "sm:flex-row sm:items-start sm:justify-between")}>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
