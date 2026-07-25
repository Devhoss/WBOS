# Alpha Test Checklist

> Reusable regression checklist for every major WBOS release.
>
> Run through these scenarios before tagging any release. Each scenario must pass
> without workarounds. If a check fails, fix the underlying architecture — never
> document known bugs as "acceptable."

---

## 1. Authentication

- [ ] User can sign up with email and password
- [ ] User can sign in with valid credentials
- [ ] Invalid credentials return clear error (no stack traces)
- [ ] Session persists across page reloads
- [ ] Session expires after configured TTL and redirects to login
- [ ] Mobile bearer token auth works: `POST /api/auth/token` returns valid token
- [ ] Mobile token is stored and reused across app restarts
- [ ] Expired mobile token triggers silent re-auth or graceful logout
- [ ] Sign out clears all session state
- [ ]  If origin header / CSRF check fails, response is descriptive

## 2. Permissions & RBAC

- [ ] Unauthenticated requests to any `/api/*` route return 401
- [ ] Users without WAREHOUSE role cannot access task APIs (403)
- [ ] Users with VIEWER role can read but not mutate entities
- [ ] ADMIN role can perform all operations
- [ ] Organization isolation: User in Org A cannot see Org B data
- [ ] Membership changes (role change / removal) take effect on next request (not cached indefinitely)

## 3. Sales Orders

- [ ] Create a sales order with 2+ line items → status DRAFT
- [ ] Submit for approval → status PENDING_APPROVAL
- [ ] Approve → status APPROVED (or INVOICED if auto-invoice enabled)
- [ ] `approvedById` is recorded on approval
- [ ] Activity log entries created for: CREATED, SUBMITTED, APPROVED
- [ ] Edit a DRAFT order → fields update correctly
- [ ] Cannot edit a non-DRAFT order → rejected
- [ ] Cancel an order from DRAFT / PENDING_APPROVAL / APPROVED / INVOICED
- [ ] Cannot cancel a PAID order → rejected
- [ ] Archive an order → hidden from default list views
- [ ] Delete a DRAFT order → permanently removed
- [ ] Cannot delete a non-DRAFT order
- [ ] Credit limit check: order exceeding customer credit limit produces a warning
- [ ] Currency defaults to KWD
- [ ] Expected ship date is optional and preserved

## 4. Shipments

- [ ] Create shipment from a sales order → status PENDING_PICK
- [ ] Pre-filled quantities match outstanding (ordered − shipped)
- [ ] Partial shipment: ship fewer than ordered → remaining balance tracked
- [ ] Over-shipment prevented → error if quantity > outstanding
- [ ] Warehouse selection required
- [ ] Shipment lines have correct product name / SKU / quantity
- [ ] Activity log: SHIPMENT_CREATED with shipment number, SO link
- [ ] Shipment appears on SO detail page
- [ ] Inventory is reserved: available stock decreases by shipment quantity

## 5. Task Creation

- [ ] Create pick task from sales order via POST `/api/v1/sales-orders/{soId}/tasks`
- [ ] Task type is PICK_ORDER
- [ ] Task status is ASSIGNED
- [ ] Task reference links to correct Sales Order
- [ ] Task lines match shipment lines (same count, product references)
- [ ] Task assigned to the creating user by default
- [ ] `taskNumber` format: TSK-YYYY-NNNNNN
- [ ] Duplicate task creation prevented: only one active task per SO at a time
- [ ] Task appears in GET `/api/v1/tasks` with status/type filters
- [ ] Activity log: TASK_CREATED

## 6. Task Assignment

- [ ] Task exposes `assignedTo: { id, name, email }`
- [ ] Task can be reassigned via PATCH assignedToId (future: implement)
- [ ] Task list filters by `assignedToId`
- [ ] Task detail shows assigned user in both web and mobile
- [ ]  Unassigning still shows the assignment (it was set at creation)

## 7. Task Lifecycle — Start

- [ ] Start an ASSIGNED task → status IN_PROGRESS
- [ ] `startedAt` timestamp recorded
- [ ] Starting a non-ASSIGNED task → TASK_INVALID_STATUS error
- [ ] Starting an already started task → error
- [ ] Activity log: TASK_STARTED
- [ ] Optimistic concurrency: stale `updatedAt` → TASK_CONFLICT error
- [ ] Shipment status: stays PENDING_PICK (changed only on first line update)

## 8. Task Lifecycle — Picking (Line Updates)

- [ ] Update task line with completed quantity → quantity reflected in DB
- [ ] Line status changes from PENDING to IN_PROGRESS when quantity > 0
- [ ] Shipment `pickedQuantity` increments by the delta
- [ ] Shipment auto-transitions PENDING_PICK → PICKING on first line pick
- [ ] Shipment auto-transitions PICKING → PICKED when all lines fully picked
- [ ] Over-picking prevented: quantity > remaining → SHIPMENT_OVER_PICK error
- [ ] Activity log: TASK_LINE_UPDATED per line update
- [ ] Updating task line on a non-IN_PROGRESS task → TASK_NOT_IN_PROGRESS error
- [ ] Shipment line references correct product and order line

## 9. Task Lifecycle — Complete

- [ ] Complete an IN_PROGRESS task → status COMPLETED
- [ ] `completedAt` timestamp recorded
- [ ] Completing a non-IN_PROGRESS task → TASK_INVALID_STATUS error
- [ ] Completing an already completed task → error
- [ ] Activity log: TASK_COMPLETED
- [ ] Sales Order status unchanged by task completion
- [ ] Shipment status unchanged by task completion (already PICKED)
- [ ] All task lines have `completedQuantity` > 0

## 10. Task Lifecycle — Cancel

- [ ] Cancel an ASSIGNED or IN_PROGRESS task → status CANCELLED
- [ ] `cancelledReason` recorded if provided
- [ ] `cancelledAt` timestamp recorded
- [ ] Cancel a COMPLETED task → error
- [ ] Cancel a CANCELLED task → error
- [ ] Activity log: TASK_CANCELLED with optional reason
- [ ] Cancelling does NOT revert shipment picked quantities

## 11. Mobile Synchronization

- [ ] Mobile fetches task list from `/api/v1/tasks?assignedToId=me`
- [ ] Mobile fetches task detail from `/api/v1/tasks/{id}`
- [ ] Mobile adapter maps TaskDetail → PickSession correctly
- [ ] All enum values match (convention: uppercase, e.g. PICK_ORDER, ASSIGNED, COMPLETED)
- [ ] `assignedTo` field is structured as `{ id, name, email } | null`
- [ ] Mobile starts task: POST `/api/v1/tasks/{id}/start`
- [ ] Mobile completes task: POST `/api/v1/tasks/{id}/complete`
- [ ] Mobile updates line: PATCH `/api/v1/tasks/{id}/lines/{lineId}`
- [ ] Mobile cancels task: POST `/api/v1/tasks/{id}/cancel`
- [ ] Mobile handles 401 by re-authenticating
- [ ] Mobile handles 409 (TASK_CONFLICT) by refreshing task and retrying
- [ ] No `/mobile/` prefix endpoints exist — canonical API is shared

## 12. Activity Logging

- [ ] Every domain event creates an activity log entry
- [ ] Log entries have: userId, action, entityType, entityId, summary, createdAt
- [ ] Task events: TASK_CREATED, TASK_STARTED, TASK_COMPLETED, TASK_CANCELLED, TASK_LINE_UPDATED
- [ ] Sales Order events: SALES_ORDER_CREATED, SALES_ORDER_SUBMITTED, SALES_ORDER_APPROVED, SALES_ORDER_CANCELLED
- [ ] Shipment events: SHIPMENT_CREATED, SHIPMENT_PICKING, SHIPMENT_PICKED, SHIPMENT_DELIVERED
- [ ] Activity logs are queryable by entityType + entityId (used for timeline)
- [ ] Timeline component renders correctly for each entity type

## 13. API Contracts

- [ ] GET `/api/v1/tasks` returns `{ data: TaskSummary[], total }`
- [ ] GET `/api/v1/tasks/{id}` returns full `ComposedTaskDetail`
- [ ] POST `/api/v1/tasks/{id}/start` accepts `{ updatedAt }` body
- [ ] POST `/api/v1/tasks/{id}/complete` accepts `{ updatedAt }` body
- [ ] POST `/api/v1/tasks/{id}/cancel` accepts `{ updatedAt, reason? }` body
- [ ] PATCH `/api/v1/tasks/{id}/lines/{lineId}` accepts `{ completedQuantity }`
- [ ] POST `/api/v1/sales-orders/{soId}/tasks` creates pick tasks from shipments
- [ ] All task API responses include full composed task detail
- [ ] All errors return structured `{ error: string }` JSON (not HTML)
- [ ] Business errors use 4xx codes (400, 403, 404, 409)
- [ ] Unexpected errors return 500 (not exposed stack traces in production)

## 14. Web UI Flows

- [ ] Tasks list page loads with correct filters (status, type)
- [ ] Search by task number / title works
- [ ] Task detail page shows: header, lines table, reference, details panel, timeline
- [ ] Start / Complete / Cancel buttons work and update state
- [ ] Button visibility matches state (Start only when ASSIGNED, etc.)
- [ ] Success/error feedback shown inline (not alert())
- [ ] Sales Order detail page shows Shipments section
- [ ] "Create Pick Task" button appears when active shipments exist
- [ ] "Create Pick Task" button hidden when active task already exists
- [ ] Navigation sidebar includes Tasks link
- [ ] All pages render without console errors

## 15. Error Handling

- [ ] Network errors show friendly message (not raw exception)
- [ ] Optimistic concurrency conflict (409) shows actionable message
- [ ] Business rule violations show the specific rule (e.g. "Task must be ASSIGNED")
- [ ] Invalid input (missing fields, wrong types) returns 400 with details
- [ ] Not found returns 404
- [ ] Forbidden (wrong role) returns 403
- [ ] Unauthenticated returns 401

## 16. Performance & Reliability

- [ ] Task list with 50+ items renders under 2s
- [ ] Task detail page loads in under 1s
- [ ] All API responses have Content-Type application/json
- [ ] Database migrations run cleanly: `prisma migrate deploy`
- [ ] Seed scripts run without errors for fresh and existing databases
- [ ] No unhandled promise rejections in server logs

## 17. Multi-User Scenarios

- [ ] User A creates SO → User B can see it (same org)
- [ ] User B creates shipment → User A can see it
- [ ] User A creates pick task → User B can start it (if assigned)
- [ ] User B picks lines → User A sees updated quantities
- [ ] Two users cannot start the same task simultaneously (optimistic concurrency)
- [ ] User A approves SO → User B cannot approve again
- [ ] Different org users see no cross-org data

---

## How to Run

```bash
# 1. Bootstrap the database
npx prisma db seed

# 2. Load demo data
node prisma/demo-seed.mjs

# 3. Run automated validation
npx tsx validation/e2e-workflow.ts

# 4. Run unit tests
npx vitest run

# 5. Typecheck
npx tsc --noEmit

# 6. Manual web checks (mark checkboxes above)
open http://localhost:3000
```
