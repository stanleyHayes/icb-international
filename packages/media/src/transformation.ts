import { TRANSFORMATION_PRESETS } from './media.constants.js';

export const TRANSFORMATION_PRESET_NAMES = [
  'document-thumbnail',
  'avatar',
  'marketing-hero',
] as const;

export type TransformationPresetName = (typeof TRANSFORMATION_PRESET_NAMES)[number];

/**
 * A named delivery transformation, expressed in provider-neutral terms. The Cloudinary
 * adapter maps these fields onto the provider's URL syntax; no provider type appears here.
 */
export interface TransformationPreset {
  readonly width: number;
  readonly height: number;
  readonly crop: 'fill' | 'fit' | 'limit';
  readonly gravity: 'auto' | 'face';
  readonly quality: 'auto' | 'auto:good' | 'auto:best';
  readonly fetchFormat: 'auto';
}

export function transformationPreset(name: TransformationPresetName): TransformationPreset {
  return TRANSFORMATION_PRESETS[name];
}
