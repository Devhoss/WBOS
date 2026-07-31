import { AppShell } from "@/components/app-shell";
import { ProductCostHistoryClient } from "./product-cost-history-client";

export const metadata = { title: "Product Cost History" };

export default function Page() {
  return (
    <AppShell>
      <ProductCostHistoryClient />
    </AppShell>
  );
}
