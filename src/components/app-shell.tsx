import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  Home,
  Package,
  ReceiptText,
  Settings,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AuthenticatedRequestContextService,
  type AuthenticatedRequestContext,
} from "@/infrastructure/request/authenticated-request-context";
import { BusinessError } from "@/shared/errors/business-error";

import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Products", href: "/products", icon: Package },
  { name: "Inventory", href: "/inventory", icon: Boxes },
  { name: "Purchasing", href: "/purchasing", icon: ClipboardList },
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Invoices", href: "/invoices", icon: ReceiptText },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Warehouses", href: "/warehouses", icon: Warehouse },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  let context: AuthenticatedRequestContext;

  try {
    context = await new AuthenticatedRequestContextService().getCurrentContext();
  } catch (error) {
    if (error instanceof BusinessError) {
      if (error.code === "ORGANIZATION_REQUIRED") {
        redirect("/onboarding");
      }

      redirect("/sign-in");
    }

    throw error;
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-muted/40 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">WBOS</p>
            <p className="text-xs text-muted-foreground">Wholesale operations</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-sm font-medium">Phase 1 Foundation</p>
            <p className="text-xs text-muted-foreground">{context.organization.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
