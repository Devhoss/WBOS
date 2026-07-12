"use client";

import { Filter, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ReportFiltersProps = {
  onFiltersChange: (filters: FilterValues) => void;
  showWarehouse?: boolean;
  showCustomer?: boolean;
  showSupplier?: boolean;
  showSearch?: boolean;
};

export type FilterValues = {
  dateFrom: string;
  dateTo: string;
  warehouseId: string;
  customerId: string;
  supplierId: string;
  search: string;
};

type DropdownOption = { id: string; name: string };

export function ReportFilters({
  onFiltersChange,
  showWarehouse,
  showCustomer,
  showSupplier,
  showSearch = true,
}: ReportFiltersProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    dateFrom: "",
    dateTo: "",
    warehouseId: "",
    customerId: "",
    supplierId: "",
    search: "",
  });
  const searchRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [warehouses, setWarehouses] = useState<DropdownOption[]>([]);
  const [customers, setCustomers] = useState<DropdownOption[]>([]);
  const [suppliers, setSuppliers] = useState<DropdownOption[]>([]);

  useEffect(() => {
    if (showWarehouse) {
      fetch("/api/warehouses").then((r) => r.json()).then(setWarehouses).catch(() => {});
    }
  }, [showWarehouse]);

  useEffect(() => {
    if (showCustomer) {
      fetch("/api/customers").then((r) => r.json()).then(setCustomers).catch(() => {});
    }
  }, [showCustomer]);

  useEffect(() => {
    if (showSupplier) {
      fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers).catch(() => {});
    }
  }, [showSupplier]);

  function update<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);

    if (key === "search") {
      if (searchRef.current) clearTimeout(searchRef.current);
      searchRef.current = setTimeout(() => onFiltersChange(next), 300);
    } else {
      onFiltersChange(next);
    }
  }

  function reset() {
    const cleared: FilterValues = {
      dateFrom: "", dateTo: "", warehouseId: "", customerId: "", supplierId: "", search: "",
    };
    setFilters(cleared);
    onFiltersChange(cleared);
  }

  function hasActiveFilters(): boolean {
    return Object.values(filters).some((v) => v !== "");
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="inline-flex items-center gap-2 text-sm font-medium lg:hidden"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <Filter className="size-4" />
          Filters
          {hasActiveFilters() ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {Object.values(filters).filter((v) => v !== "").length}
            </span>
          ) : null}
        </button>
        <p className="hidden text-sm font-medium text-muted-foreground lg:block">Filters</p>
        {hasActiveFilters() ? (
          <button
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={reset}
            type="button"
          >
            <X className="size-3" />
            Reset
          </button>
        ) : (
          <span className="text-xs text-muted-foreground" />
        )}
      </div>

      <div className={cn("border-t px-4 pb-4 pt-3", open ? "block" : "hidden lg:block")}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-from`}>From</label>
            <input
              className="h-9 w-40 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              id={`${id}-from`}
              max={filters.dateTo || undefined}
              onChange={(e) => update("dateFrom", e.target.value)}
              type="date"
              value={filters.dateFrom}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-to`}>To</label>
            <input
              className="h-9 w-40 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              id={`${id}-to`}
              min={filters.dateFrom || undefined}
              onChange={(e) => update("dateTo", e.target.value)}
              type="date"
              value={filters.dateTo}
            />
          </div>

          {showWarehouse ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-wh`}>Warehouse</label>
              <select
                className="h-9 w-44 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                id={`${id}-wh`}
                onChange={(e) => update("warehouseId", e.target.value)}
                value={filters.warehouseId}
              >
                <option value="">All warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {showCustomer ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-cust`}>Customer</label>
              <select
                className="h-9 w-44 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                id={`${id}-cust`}
                onChange={(e) => update("customerId", e.target.value)}
                value={filters.customerId}
              >
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {showSupplier ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-sup`}>Supplier</label>
              <select
                className="h-9 w-44 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                id={`${id}-sup`}
                onChange={(e) => update("supplierId", e.target.value)}
                value={filters.supplierId}
              >
                <option value="">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {showSearch ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${id}-search`}>Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-9 w-44 rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
                  id={`${id}-search`}
                  onChange={(e) => update("search", e.target.value)}
                  placeholder="Search..."
                  type="text"
                  value={filters.search}
                />
              </div>
            </div>
          ) : null}

          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            onClick={() => onFiltersChange(filters)}
            type="button"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
