export const statusBadge: Record<string, string> = {
  DRAFT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PARTIALLY_RECEIVED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  FULLY_RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  PENDING_PICK: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PICKING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PICKED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  LOADED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  READY_FOR_INVOICE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  INVOICED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PARTIALLY_PAID: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  COMPLETED: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  CREDITED: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  ARCHIVED: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  DISCONTINUED: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  Default: "bg-muted text-muted-foreground",
};

export function statusColorClass(status: string | null | undefined): string {
  return status && status in statusBadge ? statusBadge[status] : statusBadge.Default;
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}
