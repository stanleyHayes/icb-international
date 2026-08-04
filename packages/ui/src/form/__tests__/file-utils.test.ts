import { describe, expect, it } from 'vitest';

import { formatFileSize, matchesAccept, validateFiles } from '../file-utils';

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('formatFileSize', () => {
  it('picks the right unit', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatFileSize(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});

describe('matchesAccept', () => {
  it('matches extensions, exact MIME types, and wildcards', () => {
    expect(matchesAccept(makeFile('id.pdf', 'application/pdf', 1), '.pdf')).toBe(true);
    expect(matchesAccept(makeFile('id.pdf', 'application/pdf', 1), 'application/pdf')).toBe(true);
    expect(matchesAccept(makeFile('photo.png', 'image/png', 1), 'image/*')).toBe(true);
    expect(matchesAccept(makeFile('photo.png', 'image/png', 1), '.pdf')).toBe(false);
  });

  it('accepts any rule in the comma list', () => {
    expect(matchesAccept(makeFile('a.docx', 'application/x', 1), '.pdf, .docx')).toBe(true);
  });
});

describe('validateFiles', () => {
  it('partitions accepted files and rejections with reasons', () => {
    const good = makeFile('id.pdf', 'application/pdf', 100);
    const wrongType = makeFile('notes.txt', 'text/plain', 100);
    const tooBig = makeFile('scan.pdf', 'application/pdf', 10_000);
    const result = validateFiles([good, wrongType, tooBig], {
      accept: '.pdf',
      maxSizeBytes: 5000,
    });
    expect(result.accepted).toEqual([good]);
    expect(result.rejections).toEqual([
      { name: 'notes.txt', reason: 'type' },
      { name: 'scan.pdf', reason: 'size' },
    ]);
  });

  it('accepts everything when no rules are given', () => {
    const files = [makeFile('a.bin', 'application/octet-stream', 10)];
    expect(validateFiles(files, {}).accepted).toEqual(files);
  });
});
