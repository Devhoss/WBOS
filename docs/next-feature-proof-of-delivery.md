# Proof of Delivery — multi-page

**Status: implemented.**

## The requirement

Signed proof of delivery is captured with the phone's ordinary Camera app, not
in-app. A one-page invoice produces one signed photo; a two-page invoice
produces two. A delivery may also carry an extra document or photo, and photos
already sitting in the gallery must be attachable too.

Photos are **not** merged into a PDF. Each page stays its own artefact.

## The model

```
Sales Order            ← where you look it up
  └── Shipment         ← what the paperwork belongs to
        └── Attachment (attachmentType = PROOF_OF_DELIVERY, sortOrder = 1..n)
```

An order shipped twice has two signatures covering two different drops, so the
set hangs off the shipment. Flattening onto the order would lose which signature
covers which delivery.

## Why `Attachment` rather than a table of its own

An earlier draft of this document proposed a `ProofOfDeliveryDocument` table.
That was not built, because `Attachment` already carries `organizationId`,
`entityType`/`entityId`, `storageKey`, `mimeType`, `sizeBytes`, `uploadedById`,
`archivedAt` and a pluggable `provider` — and, decisively,
`/api/uploads/[...path]` **already** proves organization ownership for the
`uploads/attachments/` subtree, answering 404 rather than 403 so it cannot be
used to probe another tenant, and serving with `private, no-store`.

A second table would need a second copy of that reasoning, and the copy is where
the bug would be. Two columns were added instead:

| column | why |
| --- | --- |
| `sortOrder Int @default(0)` | Page order is chosen by the driver, not by upload time. Pages can be photographed out of order and rearranged afterwards. |
| `contentHash String?` | SHA-256 of the bytes. A partial unique index on `(organizationId, entityType, entityId, contentHash) WHERE archivedAt IS NULL` makes a retry idempotent. Partial, so removing a page and photographing it again is still allowed. |

## `SalesOrder.signedInvoicePath` — retained, not migrated

Existing rows point at real files that must keep working, so the column stays
and the routes that serve it are untouched. It is surfaced as
`legacySignedInvoicePath`, shown separately and read-only.

It is deliberately **not** backfilled into the document set and **not**
presented as "page 1": those files live under `uploads/signed-invoices/`, not
`uploads/attachments/`, so an `Attachment` row pointing at one would sit outside
the ownership check that makes the rest of the set safe. It also has no delivery
to attach to.

New writes go to the document set. The single-file upload control still appears
on the web for an order that has no shipment yet; the mobile client wrappers for
it were deleted so the phone has exactly one way to file paperwork.

## Endpoints

| route | purpose |
| --- | --- |
| `GET /api/v1/sales/orders/[soId]/proof-of-delivery` | every delivery's set, plus the legacy path |
| `GET/POST/PATCH /api/v1/deliveries/[shipmentId]/proof-of-delivery` | list, add one page, rewrite page order |
| `DELETE /api/v1/proof-of-delivery/[documentId]` | remove one page |
| `POST /api/v1/proof-of-delivery/[documentId]/download-token` | short-lived URL for the phone |
| `GET /api/proof-of-delivery/download/[token]` | streams one page |

One file per POST, not a batch: when one page of five fails, only that page
should be re-sent.

## Preserved from MOB-09

- Files live under the storage root, never in `public/`.
- Reads go through the authenticated uploads route, which resolves the file
  first and then proves ownership.
- The phone cannot open an authenticated URL with `Linking.openURL` — the system
  browser carries neither Bearer token nor cookie — so it mints a short-lived
  token first. `verifyDownloadToken` carries a `kind` (`pod-document`), so a
  token minted for an invoice cannot fetch a delivery photo.

## Explicitly out of scope

- Merging pages into a PDF.
- In-app camera capture — `expo-image-picker` hands off to the phone's own
  camera and gallery activities.
- An offline upload queue. The app is online-first; failed uploads are retried
  by the driver, in-session.
- Any change to how the existing single signed invoice is authenticated.
