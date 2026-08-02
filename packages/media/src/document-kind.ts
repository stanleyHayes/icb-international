/**
 * Document kinds the bank stores. Each kind maps to a folder convention, a MIME/size
 * allow-list, and (where applicable) transformation presets.
 */
export const DOCUMENT_KINDS = [
  'kyc',
  'dispute-evidence',
  'statements',
  'avatars',
  'marketing',
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Cloudinary delivery resource types, mirrored from the `assetRef` contract. */
export type AssetResourceType = 'image' | 'raw' | 'video';

const NON_SLUG_CHARACTERS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

/**
 * Folder convention: `<rootFolder>/<kind>/<ownerId>`. The owner scopes every asset to the
 * customer, dispute, or account it belongs to, so a folder listing is an audit trail.
 */
export function assetFolder(rootFolder: string, kind: DocumentKind, ownerId: string): string {
  return `${rootFolder}/${kind}/${ownerId}`;
}

/**
 * Public-id convention: `<slug-of-label>-<uniqueId>`. The label keeps ids greppable
 * (`passport-a1b2…`), the unique suffix guarantees no collisions and no overwrite of an
 * asset already referenced by a document.
 */
export function buildPublicId(label: string, uniqueId: string): string {
  const slug = label
    .toLowerCase()
    .replace(NON_SLUG_CHARACTERS, '-')
    .replace(EDGE_DASHES, '');
  return `${slug.length > 0 ? slug : 'asset'}-${uniqueId}`;
}
