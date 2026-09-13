# Decisions

## Repo root

The Next.js app lives at the SmartDocumentBuilder workspace root (package name `document-inspector`), not a nested `doc-extractor/` folder.

## Client-only pipeline

pdf.js, Tesseract, compromise, IndexedDB, and MiniSearch all run in the browser. There is no extraction API. That keeps files on-device and matches the “inspector” product: review happens where the file already is.

## Type contract extensions

`src/lib/types.ts` keeps the five core types from the spec. Three additions exist only because the UX / definition of done cannot be met otherwise:

- `DocumentRecord.statusDetail` — page-level copy such as “Rendering page 2 of 5…” without a second status enum.
- `DocumentRecord.pageCount` / `mimeType` — OCR progress and PageViewer reload.
- `AuditEvent` store — every status transition with a timestamp, not just `editHistory`.

Original file blobs are in a `files` object store so PageViewer can re-render after a reload (round-trip gate).

## Confidence

Weighted mix: OCR (0.4) + pattern strength (0.3) + layout-fingerprint boost (0.2) + completeness (0.1). Tiers: high ≥ 0.8, medium ≥ 0.5, else low. Repeat fingerprints on committed docs boost the fingerprint term. Garbled `O`/`0` values are forced out of high.

Commit is blocked only on **unresolved low** fields (`tier === 'low' && !edited`).

## Search

MiniSearch is rebuilt from committed documents (`rawText` + field text). Facets are derived from fields that actually exist; empty types are omitted. Query syntax (`type:`, `range:`, `~`) is optional.

## Deploy

Standard Next.js (not static export) so pdf.js / Tesseract workers resolve cleanly on Vercel.
