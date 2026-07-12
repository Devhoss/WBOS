import {
  ArrowUpDown,
  Award,
  Barcode,
  BarChart3,
  Box,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Handshake,
  LineChart,
  Package,
  PackageCheck,
  PackageMinus,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Star,
  StopCircle,
  Store,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

type ReportLink = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
};

type ReportCategory = {
  title: string;
  reports: ReportLink[];
};

const categories: ReportCategory[] = [
  {
    title: "Sales",
    reports: [
      { title: "Sales by Customer", description: "Revenue and orders grouped by customer", icon: <Users className="size-5" />, href: "/reports/sales/by-customer" },
      { title: "Sales by Product", description: "Revenue and units sold per product", icon: <Package className="size-5" />, href: "/reports/sales/by-product" },
      { title: "Sales by Category", description: "Sales performance across product categories", icon: <BarChart3 className="size-5" />, href: "/reports/sales/by-category" },
      { title: "Sales by Warehouse", description: "Revenue distribution by warehouse location", icon: <Store className="size-5" />, href: "/reports/sales/by-warehouse" },
      { title: "Sales Trend", description: "Daily, weekly, and monthly sales trends over time", icon: <LineChart className="size-5" />, href: "/reports/sales/trend" },
      { title: "Top Selling Products", description: "Highest revenue and volume products ranked", icon: <Award className="size-5" />, href: "/reports/sales/top-products" },
      { title: "Top Customers", description: "Customers ranked by total spend and frequency", icon: <Star className="size-5" />, href: "/reports/sales/top-customers" },
      { title: "Avg Order Value", description: "Average transaction value over selected period", icon: <ShoppingCart className="size-5" />, href: "/reports/sales/average-order-value" },
    ],
  },
  {
    title: "Purchasing",
    reports: [
      { title: "Purchases by Supplier", description: "Spend and order volume per supplier", icon: <Handshake className="size-5" />, href: "/reports/purchasing/by-supplier" },
      { title: "Purchases by Product", description: "Purchase history and costs tracked per product", icon: <PackageMinus className="size-5" />, href: "/reports/purchasing/by-product" },
      { title: "Outstanding POs", description: "Open purchase orders awaiting receipt or approval", icon: <ClipboardList className="size-5" />, href: "/reports/purchasing/outstanding-orders" },
      { title: "Supplier Performance", description: "On-time delivery and quality metrics by supplier", icon: <Zap className="size-5" />, href: "/reports/purchasing/supplier-performance" },
      { title: "Receiving History", description: "Record of all received shipments and receipts", icon: <PackageCheck className="size-5" />, href: "/reports/purchasing/receiving-history" },
    ],
  },
  {
    title: "Inventory",
    reports: [
      { title: "Current Stock", description: "Real-time stock levels across all warehouses", icon: <Box className="size-5" />, href: "/reports/inventory/current-stock" },
      { title: "Inventory Valuation", description: "Stock value calculated by cost method", icon: <DollarSign className="size-5" />, href: "/reports/inventory/valuation" },
      { title: "Stock Movement", description: "Inbound and outbound transaction history", icon: <ArrowUpDown className="size-5" />, href: "/reports/inventory/stock-movement" },
      { title: "Inventory Aging", description: "Stock categorized by days in warehouse", icon: <Clock className="size-5" />, href: "/reports/inventory/aging" },
      { title: "Slow Moving", description: "Products with low turnover rates", icon: <StopCircle className="size-5" />, href: "/reports/inventory/slow-moving" },
      { title: "Fast Moving", description: "High-velocity products with frequent turnover", icon: <TrendingUp className="size-5" />, href: "/reports/inventory/fast-moving" },
      { title: "Negative Stock", description: "Stock discrepancies where on-hand is below zero", icon: <PackageMinus className="size-5" />, href: "/reports/inventory/negative-stock" },
      { title: "Reserved Stock", description: "Inventory allocated to open orders", icon: <ClipboardList className="size-5" />, href: "/reports/inventory/reserved-stock" },
      { title: "Cycle Count History", description: "Physical count records and adjustment logs", icon: <FileText className="size-5" />, href: "/reports/inventory/cycle-count-history" },
    ],
  },
  {
    title: "Financial",
    reports: [
      { title: "Customer Statement", description: "Detailed statement of customer transactions and balance", icon: <Receipt className="size-5" />, href: "/reports/financial/customer-statement" },
      { title: "Outstanding Balances", description: "All unpaid customer invoices and credits", icon: <CreditCard className="size-5" />, href: "/reports/financial/outstanding-balances" },
      { title: "A/R Aging", description: "Receivables categorized by age brackets", icon: <Clock className="size-5" />, href: "/reports/financial/ar-aging" },
      { title: "Invoice Register", description: "Complete list of issued sales invoices", icon: <FileText className="size-5" />, href: "/reports/financial/invoice-register" },
      { title: "Payment Register", description: "Record of all payments received from customers", icon: <DollarSign className="size-5" />, href: "/reports/financial/payment-register" },
      { title: "Cash Collection", description: "Cash inflow tracking from customer payments", icon: <PiggyBank className="size-5" />, href: "/reports/financial/cash-collection" },
    ],
  },
  {
    title: "Operations",
    reports: [
      { title: "Shipment Status", description: "Real-time tracking of outbound shipments", icon: <Truck className="size-5" />, href: "/reports/operational/shipment-status" },
      { title: "Delivery Performance", description: "On-time delivery metrics and carrier performance", icon: <Zap className="size-5" />, href: "/reports/operational/delivery-performance" },
      { title: "Picking Performance", description: "Picker productivity and accuracy metrics", icon: <BarChart3 className="size-5" />, href: "/reports/operational/picking-performance" },
      { title: "Barcode Activity", description: "Scan events and barcode usage logs", icon: <Barcode className="size-5" />, href: "/reports/operational/barcode-activity" },
      { title: "Warehouse Activity", description: "Overall operations summary per warehouse zone", icon: <Warehouse className="size-5" />, href: "/reports/operational/warehouse-activity" },
    ],
  },
];

const iconColors = [
  "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
  "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950",
  "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950",
  "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950",
  "text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950",
  "text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950",
  "text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-950",
  "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950",
];

export default function ReportsPage() {
  return (
    <AppShell>
    <div className="space-y-10">
      <div className="border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Access dashboards and detailed reports across Sales, Purchasing, Inventory, Financial, and Operations.
        </p>
      </div>

      {categories.map((category, catIdx) => (
        <section key={category.title}>
          <h2 className="text-lg font-semibold">{category.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.reports.map((report, i) => (
              <Link
                key={report.href}
                className="group rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition hover:border-primary/50 hover:shadow-md"
                href={report.href}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-md",
                    iconColors[(catIdx + i) % iconColors.length],
                  )}>
                    {report.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium group-hover:text-primary">{report.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{report.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
    </AppShell>
  );
}
