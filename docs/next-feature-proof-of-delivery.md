# Next mobile feature — multi-page Proof of Delivery

**Status: specified, not implemented.** Recorded here so the requirement is not
lost and so the MOB-09 storage work is not undone by whoever picks it up.

## The requirement

Signed proof of delivery is captured with the phone's ordinary Camera app, not
in-app. A one-page invoice produces one signed photo; a two-page invoice
produces two. A delivery may also carry an extra document or photo.

So proof of delivery is **a set of attachments against one delivery**, not a
single file. The current model stores exactly one path per sales order
(`SalesOrder.signedInvoicePath`), which cannot express page 2.

Photos are **not** to be merged into a PDF. Each page stays its own artefact.

## Conceptual model

```
Sales Order / Delivery
  └── Proof of Delivery
      ├── signed page 1
      ├── signed page 2
      └── optional additional document / photo
```

## What already exists and must be preserved

MOB-09 moved signed invoices off the public static directory. Do not undo any
of this when generalising to many files:

- Files live under the storage root at
  `uploads/signed-invoices/<organizationId>/<name>`, never in `public/`.
  `public/` is served by Next with no session check — that was the bug.
  See `src/infrastructure/storage/storage-root.ts` and
  `src/domains/sales/signed-invoice-storage.ts`.
- Reads go through `GET /api/uploads/...`, which resolves the file first and
  then proves the caller's organization owns it, answering 404 rather than 403
  so the endpoint cannot be used to probe for another tenant's documents.
- The mobile app cannot open an authenticated URL with `Linking.openURL`,
  because the system browser carries neither the Bearer token nor a cookie. It
  requests a short-lived token first
  (`POST /api/v1/sales/signed-invoice/[soId]/download-token`) and opens the
  returned URL. Any per-page viewer must do the same.
- `verifyDownloadToken` carries a `kind`, so a token minted for one resource
  cannot fetch another.

## The smallest change that supports it

A `ProofOfDeliveryDocument` table — `id`, `organizationId`, `salesOrderId`,
`shipmentId?`, `storageKey`, `mimeType`, `sizeBytes`, `pageNumber?`,
`uploadedById`, `createdAt` — with `SalesOrder.signedInvoicePath` retained for
existing rows and read as "page 1" until it is migrated away. That keeps the
one-file case working while the many-file case is built.

Upload, download-token and the uploads-route ownership check all generalise to
a document id rather than a sales-order id. Nothing about the storage or auth
architecture needs to change.

## Explicitly out of scope

- Merging pages into a PDF.
- In-app camera capture (the phone's Camera app is the capture tool).
- Any change to how the existing single signed invoice is authenticated.
