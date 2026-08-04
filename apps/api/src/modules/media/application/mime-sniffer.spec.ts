import { describe, expect, it } from 'vitest';

import { sniffMimeType } from './mime-sniffer.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = new TextEncoder().encode('%PDF-1.7\n…');
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

describe('sniffMimeType', () => {
  it.each([
    ['image/png', PNG],
    ['image/jpeg', JPEG],
    ['application/pdf', PDF],
    ['image/webp', WEBP],
  ])('recognises %s from its magic bytes', (expected, bytes) => {
    expect(sniffMimeType(bytes)).toBe(expected);
  });

  it('does not mistake a bare RIFF container for WebP', () => {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffMimeType(wav)).toBeNull();
  });

  it('returns null for unrecognised bytes', () => {
    expect(sniffMimeType(new Uint8Array([0x7f, 0x45, 0x4c, 0x46]))).toBeNull(); // ELF
    expect(sniffMimeType(new TextEncoder().encode('<html><body>x</body></html>'))).toBeNull();
  });

  it('returns null for a truncated signature', () => {
    expect(sniffMimeType(PNG.subarray(0, 4))).toBeNull();
    expect(sniffMimeType(new Uint8Array(0))).toBeNull();
  });
});
