"use server";

import type { ReportFilters } from "../dto/report-types";
import { SalesReportService } from "./sales-report-service";
import { PurchasingReportService } from "./purchasing-report-service";
import { InventoryReportService } from "./inventory-report-service";
import { FinancialReportService } from "./financial-report-service";
import { OperationalReportService } from "./operational-report-service";
import { ExportService } from "./export-service";

const exportService = new ExportService();

const sales = new SalesReportService();
const purchasing = new PurchasingReportService();
const inventory = new InventoryReportService();
const financial = new FinancialReportService();
const operational = new OperationalReportService();

/* ── Sales ── */
export async function getSalesByCustomer(f: ReportFilters) { return sales.byCustomer(f); }
export async function getSalesByProduct(f: ReportFilters) { return sales.byProduct(f); }
export async function getSalesByCategory(f: ReportFilters) { return sales.byCategory(f); }
export async function getSalesByWarehouse(f: ReportFilters) { return sales.byWarehouse(f); }
export async function getSalesTrend(f: ReportFilters) { return sales.trend(f); }
export async function getTopProducts(f: ReportFilters) { return sales.topProducts(f); }
export async function getTopCustomers(f: ReportFilters) { return sales.topCustomers(f); }
export async function getAverageOrderValue(f: ReportFilters) { return [await sales.averageOrderValue(f)]; }

/* ── Purchasing ── */
export async function getPurchasesBySupplier(f: ReportFilters) { return purchasing.bySupplier(f); }
export async function getPurchasesByProduct(f: ReportFilters) { return purchasing.byProduct(f); }
export async function getOutstandingOrders(f: ReportFilters) { return purchasing.outstandingOrders(f); }
export async function getSupplierPerformance(f: ReportFilters) { return purchasing.supplierPerformance(f); }
export async function getReceivingHistory(f: ReportFilters) { return purchasing.receivingHistory(f); }

/* ── Inventory ── */
export async function getCurrentStock(f: ReportFilters) { return inventory.currentStock(f); }
export async function getInventoryValuation(f: ReportFilters) { return inventory.valuation(f); }
export async function getStockMovement(f: ReportFilters) { return inventory.stockMovement(f); }
export async function getInventoryAging(f: ReportFilters) { return inventory.aging(f); }
export async function getSlowMovingItems(f: ReportFilters) { return inventory.slowMoving(f); }
export async function getFastMovingItems(f: ReportFilters) { return inventory.fastMoving(f); }
export async function getNegativeStock() { return inventory.negativeStock(); }
export async function getReservedStock() { return inventory.reservedStock(); }
export async function getCycleCountHistory(f: ReportFilters) { return inventory.cycleCountHistory(f); }

/* ── Financial ── */
export async function getCustomerStatement(customerId: string, f: ReportFilters) { return financial.customerStatement(customerId, f); }
export async function getOutstandingBalances() { return financial.outstandingBalances(); }
export async function getArAging(f: ReportFilters) { return financial.arAging(f); }
export async function getInvoiceRegister(f: ReportFilters) { return financial.invoiceRegister(f); }
export async function getPaymentRegister(f: ReportFilters) { return financial.paymentRegister(f); }
export async function getCashCollection(f: ReportFilters) { return financial.cashCollection(f); }

/* ── Operational ── */
export async function getShipmentStatus(f: ReportFilters) { return operational.shipmentStatus(f); }
export async function getDeliveryPerformance(f: ReportFilters) { return [await operational.deliveryPerformance(f)]; }
export async function getPickingPerformance(f: ReportFilters) { return [await operational.pickingPerformance(f)]; }
export async function getBarcodeActivity(f: ReportFilters) { return operational.barcodeActivity(f); }
export async function getWarehouseActivity(f: ReportFilters) { return operational.warehouseActivity(f); }

/* ── Export ── */
export async function exportCsv(data: Record<string, unknown>[], columns: { key: string; label: string }[], filename: string) {
  return exportService.toCsv(data, columns.map((c) => ({ key: c.key, label: c.label })));
}
