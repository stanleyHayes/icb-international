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

/**
 * Runs of anything that is not lower-case alphanumeric. Used with `split` rather than
 * `replace`: splitting has no alternation to backtrack over, and leading or trailing
 * separators fall out as empty segments that are simply dropped.
 */
const NON_SLUG_CHARACTERS = /[^a-z0-9]+/;

const FALLBACK_SLUG = 'asset';

/**
 * Folder convention: `<rootFolder>/<kind>/<ownerId>`. The owner scopes every asset to the
 * customer, dispute, or account it belongs to, so a folder listing is an audit trail.
 */
export function assetFolder(rootFolder: string, kind: DocumentKind, ownerId: string): string {
  return `${rootFolder}/${kind}/${ownerId}`;
}

/** Lower-cased, dash-separated, alphanumeric only. Safe in a URL path and in a filename. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .split(NON_SLUG_CHARACTERS)
    .filter((part) => part.length > 0)
    .join('-');
}

/**
 * Public-id convention: `<slug-of-label>-<uniqueId>`. The label keeps ids greppable
 * (`passport-a1b2…`), the unique suffix guarantees no collisions and no overwrite of an
 * asset already referenced by a document.
 */
export function buildPublicId(label: string, uniqueId: string): string {
  const slug = slugify(label);
  return `${slug.length > 0 ? slug : FALLBACK_SLUG}-${uniqueId}`;
}
