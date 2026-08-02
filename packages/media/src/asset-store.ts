import type { AssetRef } from './asset-ref.js';
import type { TransformationPresetName } from './transformation.js';
import type { MintUploadInput, SignedUpload } from './upload-signature.js';

export interface DeliveryOptions {
  /** Named transformation to bake into the URL. Images only. */
  preset?: TransformationPresetName;
  /** Overrides the store's default delivery TTL. */
  expiresInSeconds?: number;
}

/** Injectable side effects shared by both store implementations. */
export interface StoreDeps {
  /** Epoch milliseconds. Injected so tests — and the simulation clock — control time. */
  now?: () => number;
  generateId?: () => string;
}

/**
 * A short-lived signed delivery link. `expiresAt` is when the issuing service stops
 * honouring the link — links are re-minted per request and never persisted.
 */
export interface SignedDelivery {
  url: string;
  expiresAt: string;
}

/**
 * The store contract. `CloudinaryAssetStore` talks to the real provider;
 * `LocalAssetStore` answers with the same shapes against the filesystem so a checkout
 * without credentials still runs the full flow.
 */
export interface AssetStore {
  mintUploadSignature(input: MintUploadInput): SignedUpload;
  signedDeliveryUrl(ref: AssetRef, options?: DeliveryOptions): SignedDelivery;
}
