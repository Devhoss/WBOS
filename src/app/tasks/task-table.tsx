"use client";

import { ArrowUpDown, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { statusColorClass, formatStatus } from "@/components/status-colors";

type TaskRow = {
  id: string;
  taskNumber: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  subtitle: string;
  warehouseName: string;
  assignedToName: string;
  createdAt: string;
};

type SortKey = "taskNumber" | "status" | "type" | "priority" | "createdAt";
type SortDir = "asc" | "desc";

function Th({ children, onClick, active, align }: { children: React.ReactNode; onClick: () => void; active: boolean; align?: "left" | "right" }) {
  return (
    <th className={`h-10 cursor-pointer select-none px-3 text-xs font-semibold uppercase transition hover:text-foreground ${align === "right" ? "text-right" : "text-left"}`} onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`size-3 ${active ? "text-foreground" : "opacity-40"}`} />
      </span>
    </th>
  );
}

const typeLabels: Record<string, string> = {
  PICK_ORDER: "Pick",
  GOODS_RECEIPT: "Receipt",
  CYCLE_COUNT: "Count",
  INVENTORY_TRANSFER: "Transfer",
  DELIVERY: "Delivery",
};

export function TaskTable({ tasks, total }: { tasks: TaskRow[]; total: number }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return tasks
      .filter((t) => {
        if (query && !t.taskNumber.toLowerCase().includes(query) && !t.title.toLowerCase().includes(query) && !t.assignedToName.toLowerCase().includes(query)) return false;
        if (statusFilter && t.status !== statusFilter) return false;
        if (typeFilter && t.type !== typeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortKey === "taskNumber") return a.taskNumber.localeCompare(b.taskNumber) * dir;
        if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
        if (sortKey === "type") return a.type.localeCompare(b.type) * dir;
        if (sortKey === "priority") return a.priority.localeCompare(b.priority) * dir;
        if (sortKey === "createdAt") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() * dir;
        return 0;
      });
  }, [tasks, search, statusFilter, typeFilter, sortKey, sortDir]);

  const statuses = [...new Set(tasks.map((t) => t.status))];
  const types = [...new Set(tasks.map((t) => t.type))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm grow">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            placeholder="Search tasks..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => (<option key={s} value={s}>{formatStatus(s)}</option>))}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
          value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => (<option key={t} value={t}>{typeLabels[t] ?? t}</option>))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
            <tr className="border-b">
              <Th onClick={() => toggleSort("taskNumber")} active={sortKey === "taskNumber"}>Task #</Th>
              <Th onClick={() => toggleSort("type")} active={sortKey === "type"}>Type</Th>
              <Th onClick={() => toggleSort("status")} active={sortKey === "status"}>Status</Th>
              <th className="h-10 px-3 text-left text-xs font-semibold">Title</th>
              <Th onClick={() => toggleSort("priority")} active={sortKey === "priority"}>Priority</Th>
              <th className="h-10 px-3 text-left text-xs font-semibold">Warehouse</th>
              <th className="h-10 px-3 text-left text-xs font-semibold">Assigned To</th>
              <Th onClick={() => toggleSort("createdAt")} active={sortKey === "createdAt"}>Created</Th>
              <th className="h-10 w-20 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="h-10 px-3 font-mono text-xs font-medium">{t.taskNumber}</td>
                <td className="h-10 px-3 text-muted-foreground">{typeLabels[t.type] ?? t.type}</td>
                <td className="h-10 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColorClass(t.status)}`}>
                    {formatStatus(t.status)}
                  </span>
                </td>
                <td className="h-10 px-3">
                  <span className="font-medium">{t.title}</span>
                  {t.subtitle ? <span className="ml-1 text-xs text-muted-foreground">— {t.subtitle}</span> : null}
                </td>
                <td className="h-10 px-3">
                  {t.priority === "HIGH" || t.priority === "URGENT" ? (
                    <span className={`text-xs font-medium ${t.priority === "URGENT" ? "text-red-500" : "text-amber-500"}`}>
                      {t.priority}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="h-10 px-3 text-muted-foreground">{t.warehouseName}</td>
                <td className="h-10 px-3 text-muted-foreground">{t.assignedToName}</td>
                <td className="h-10 px-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="h-10 px-3 text-right">
                  <Link href={`/tasks/${t.id}`} className="text-xs font-medium text-primary hover:underline">View</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                {search || statusFilter || typeFilter ? "No tasks match your filters." : "No tasks yet."}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {total} tasks</p>
    </div>
  );
}
