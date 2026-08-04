/**
 * Validation and formatting for {@link FileDropzone}. Pure so the accept/size rules are
 * testable without a DOM, and so a server route could reuse them verbatim.
 */

export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;
const FILE_SIZE_STEP = 1024;

export const DEFAULT_MAX_FILES = 5;

export type FileRejectReason = 'type' | 'size';

export interface FileRejection {
  readonly name: string;
  readonly reason: FileRejectReason;
}

export interface FileValidation {
  readonly accepted: File[];
  readonly rejections: FileRejection[];
}

export interface FileRules {
  /** Native `accept` syntax: comma-separated extensions (`".pdf"`) or MIME types (`"image/*"`). */
  readonly accept?: string | undefined;
  readonly maxSizeBytes?: number | undefined;
}

/** Human-readable size, one decimal for fractional units: `1.5 MB`. */
export function formatFileSize(bytes: number): string {
  let value = Math.max(bytes, 0);
  let unit = 0;
  while (value >= FILE_SIZE_STEP && unit < FILE_SIZE_UNITS.length - 1) {
    value /= FILE_SIZE_STEP;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${rounded} ${FILE_SIZE_UNITS[unit]}`;
}

function matchesAcceptRule(file: File, rule: string): boolean {
  const trimmed = rule.trim().toLowerCase();
  if (trimmed.startsWith('.')) {
    return file.name.toLowerCase().endsWith(trimmed);
  }
  if (trimmed.endsWith('/*')) {
    return file.type.toLowerCase().startsWith(trimmed.slice(0, -1));
  }
  return file.type.toLowerCase() === trimmed;
}

export function matchesAccept(file: File, accept: string): boolean {
  return accept.split(',').some((rule) => matchesAcceptRule(file, rule));
}

/** Partition files into those passing the rules and per-file rejections with reasons. */
export function validateFiles(files: readonly File[], rules: FileRules): FileValidation {
  const accepted: File[] = [];
  const rejections: FileRejection[] = [];
  for (const file of files) {
    if (rules.accept != null && rules.accept !== '' && !matchesAccept(file, rules.accept)) {
      rejections.push({ name: file.name, reason: 'type' });
    } else if (rules.maxSizeBytes != null && file.size > rules.maxSizeBytes) {
      rejections.push({ name: file.name, reason: 'size' });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejections };
}
