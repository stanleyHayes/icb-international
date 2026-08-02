/** Base class for every failure originating in the media package. */
export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Thrown when an upload's MIME type is not in the allow-list for its document kind. */
export class UnsupportedMediaTypeError extends MediaError {
  constructor(
    readonly kind: string,
    readonly contentType: string,
  ) {
    super(`Media type ${contentType} is not allowed for ${kind} assets`);
  }
}

/** Thrown when an upload exceeds the size ceiling for its document kind. */
export class AssetTooLargeError extends MediaError {
  constructor(
    readonly kind: string,
    readonly sizeBytes: number,
    readonly maxBytes: number,
  ) {
    super(`Asset of ${String(sizeBytes)} bytes exceeds the ${kind} limit of ${String(maxBytes)}`);
  }
}

/** Thrown when a value does not satisfy the `assetRef` contract shape. */
export class InvalidAssetRefError extends MediaError {
  constructor(reason: string) {
    super(`Invalid asset reference: ${reason}`);
  }
}

/** Thrown when a transformation preset is requested for an asset that cannot be transformed. */
export class TransformationNotSupportedError extends MediaError {
  constructor(
    readonly resourceType: string,
    readonly preset: string,
  ) {
    super(`Transformation preset ${preset} cannot be applied to ${resourceType} assets`);
  }
}

/** Thrown when a folder or public id would escape the local storage root. */
export class UnsafeAssetPathError extends MediaError {
  constructor(readonly path: string) {
    super(`Asset path segment is not safe to persist: ${path}`);
  }
}
