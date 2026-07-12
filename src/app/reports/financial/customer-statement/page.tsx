import { AppShell } from "@/components/app-shell";
import { CustomerStatementClient } from "./customer-statement-client";

export const metadata = { title: "Customer Statement" };

export default function Page() {
  return (
    <AppShell>
      <CustomerStatementClient />
    </AppShell>
  );
}
