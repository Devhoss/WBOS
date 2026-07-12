WBOS Warehouse — Canonical Workflow Documentation
Shipment States
PENDING_PICK ──(first scan)──▶ PICKING ──(all fully picked)──▶ PICKED
                                                                     │
                                                                (manual)
                                                                     ▼
                                                                  LOADED
                                                                     │
                                                                (manual)
                                                                     ▼
                                                             OUT_FOR_DELIVERY
                                                             ┌──────┴──────┐
                                                        (confirm)    (fail)
                                                             │          │
                                                             ▼          ▼
                                                         DELIVERED    FAILED
Status	Description
PENDING_PICK	Created, not yet started
PICKING	Active picking in progress
PICKED	All lines fully picked, ready to load
LOADED	Loaded onto truck
OUT_FOR_DELIVERY	In transit to customer
DELIVERED	Confirmed delivered, inventory posted
FAILED	Delivery failed, reason captured
Key Design Decisions
1. Inventory deducted on delivery, not pick. Stock stays in the warehouse until the driver confirms delivery. This matches real logistics — picked goods sit on a pallet in the warehouse until loaded and delivered.
2. Unit-level barcode scanning. Each barcode scan increments pickedQuantity by 1 on the ShipmentLine. The server auto-advances status when the first scan happens (→PICKING) and when all lines are fully picked (→PICKED). Over-scans are rejected (pickedQuantity ≥ quantity).
3. Delivery is an atomic transaction. confirm-delivery.ts wraps inventory posting (InventoryPostingService.post), SO line shippedQuantity update, and shipment status close in a Prisma $transaction. If anything fails, nothing changes.
4. Self Approval is default (approvalMode: SELF). Dual Approval mode (DUAL) enforces creator ≠ approver restrictions.
Architecture
┌─ UI Layer ─────────────────────────────────────────────┐
│  shipment-detail/page.tsx   picking-list.tsx           │
│  shipment-status-action.tsx  shipment-complete-action   │  ← ShipmentDeliverAction
│  (shipments list page, dashboard)                       │
└──────────────────────┬──────────────────────────────────┘
                       │ calls
                       ▼
┌─ Actions Layer ────────────────────────────────────────┐
│  scan-pick.ts        scanPickAction(shipmentId,barcode)│  ← unit-level pick
│  confirm-delivery.ts confirmDeliveryAction(id)          │  ← atomic delivery
│  update-shipment-status.ts  (PICKED/LOADED/OUT_FOR)    │
└──────────────────────┬──────────────────────────────────┘
                       │ delegates
                       ▼
┌─ Service Layer ────────────────────────────────────────┐
│  ShipmentService.create()                               │
│  ShipmentService.scanPick()    ← auto-status advance    │
│  ShipmentService.deliver()     ← $transaction+posting   │
│  ShipmentService.updateStatus()                         │
└──────────────────────┬──────────────────────────────────┘
                       │ uses
                       ▼
┌─ Repository/Infra ─────────────────────────────────────┐
│  ShipmentRepository   (CRUD + incrementPickedQuantity)  │
│  InventoryPostingService (post in tx)                   │
│  ActivityLogRepository  (every event logged)            │
│  RBAC: OWNER/ADMIN/MANAGER/WAREHOUSE                    │
└─────────────────────────────────────────────────────────┘
Relevant Files
File
prisma/schema.prisma
src/domains/sales/repositories/shipment-repository.ts
src/domains/sales/services/shipment-service.ts
src/domains/sales/actions/scan-pick.ts
src/domains/sales/actions/confirm-delivery.ts
src/domains/sales/actions/update-shipment-status.ts
src/app/sales/shipments/[shipmentId]/page.tsx
src/app/sales/shipments/[shipmentId]/picking-list.tsx
src/app/sales/shipments/shipment-status-action.tsx
src/app/sales/shipments/shipment-complete-action.tsx
src/components/barcode-scan-input.tsx
What was removed (old workflow)
- pick-shipment-line.ts — binary toggle (old)
- verify-shipment-line.ts — verification step (old)
- complete-shipment.ts — old delivery (replaced by atomic confirm-delivery.ts)
- ShipmentLine.pickedById, ShipmentLine.verifiedById — replaced by pickedQuantity counter
- Shipment.shippedAt — replaced by per-stage timestamps
Extension Points (for next phases)
- Mobile scanner view — full-screen barcode input overlaying the picking list
- Reports — pick completeness, delivery times, failure rates by warehouse
- Proof of delivery — signature capture, photo upload on DELIVERED
- GPS — track OUT_FOR_DELIVERY location per driver
- Notifications — alert warehouse when delivery is confirmed
- Returns — reverse flow back into inventory