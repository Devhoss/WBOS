import { AppShell } from "@/components/app-shell";
import { CostCardClient } from "./cost-card-client";

export const metadata = { title: "Product Cost Card" };

export default function Page() {
  return (
    <AppShell>
      <CostCardClient />
    </AppShell>
  );
}
