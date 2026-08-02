# ADR-12: Cloudinary for all document and media storage

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

KYC documents, dispute evidence, generated statement PDFs, avatars, and marketing imagery all
need upload, transformation, and access-controlled delivery. Bytes must not transit the API
(they are large and the API is not a file proxy), and downloads must never be public links.
Cloudinary is the second permitted egress under N2.

## Decision

All document and media storage goes through Cloudinary, wrapped by `@icb/media`. The API mints
signatures for signed direct-to-Cloudinary uploads; delivery uses signed, expiring URLs minted
per request. Documents store an `assetRef` value type, never a raw URL. Without keys, a
`LocalAssetStore` writing to `storage/` with the same `assetRef` shape is bound instead.

## Rationale

- Signed uploads, on-the-fly derivation (thumbnails, avatars, hero crops), and access-controlled
  delivery come built in — no storage service to build or operate.
- Signed direct uploads keep document bytes off the API entirely; the API only ever handles
  signatures and metadata.
- The `assetRef` indirection and the local fallback keep the rest of the system provider-agnostic
  and offline-capable.

## Rejected alternatives

- **Local disk** — not shareable across processes or deploys, and no transformations.
- **S3** — durable storage, but transformations and signed delivery would be hand-rolled
  (Lambda@Edge/CloudFront signing), which is a storage-service build by another name.
