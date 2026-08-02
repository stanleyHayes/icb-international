import type { AssetRef } from './asset-ref.js';
import type { DocumentKind } from './document-kind.js';
import type { TransformationPresetName } from './transformation.js';
import type { MintUploadInput, SignedUpload } from './upload-signature.js';

export interface DeliveryOptions {
  /** Named transformation to bake into the URL. Images only; raw assets are served as stored. */
  preset?: TransformationPresetName;
  /** Ask the browser to save the file rather than render it inline. */
  download?: boolean;
}

/** Injectable side effects shared by both store implementations. */
export interface StoreDeps {
  /** Epoch milliseconds. Injected so tests — and the simulation clock — control time. */
  now?: () => number;
  generateId?: () => string;
}

/**
 * Bytes the API produced itself — a rendered statement, a generated letter — rather than
 * bytes a browser is about to post. Folder and public id are derived from the conventions,
 * so a caller cannot place an asset outside its owner's namespace.
 */
export interface AssetUpload {
  kind: DocumentKind;
  ownerId: string;
  contentType: string;
  bytes: Uint8Array;
  label?: string;
  originalFilename?: string;
}

/**
 * A short-lived signed delivery link. `expiresAt` is the instant the link stops working —
 * links are minted per request and never persisted.
 */
export interface SignedDelivery {
  url: string;
  expiresAt: string;
}

/**
 * The store port. `CloudinaryAssetStore` talks to the real provider; `LocalAssetStore`
 * answers with the same shapes against the filesystem, so a checkout without credentials
 * still runs the full flow end to end.
 */
export interface AssetStore {
  /** A grant the browser uses to post bytes straight to the provider. */
  mintUploadSignature(input: MintUploadInput): SignedUpload;
  /** Server-side upload of bytes the API generated. Returns the ref to store on the record. */
  upload(input: AssetUpload): Promise<AssetRef>;
  /** A signed URL valid for `ttlSeconds`. Never stored — re-minted on every download. */
  buildSignedUrl(ref: AssetRef, ttlSeconds?: number, options?: DeliveryOptions): SignedDelivery;
  /** Permanently removes the asset. Used when a record is deleted or a render is superseded. */
  destroy(ref: AssetRef): Promise<void>;
}
