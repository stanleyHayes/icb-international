import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Without the merge step, `cn('p-2', 'p-4')` emits both and the winner depends on stylesheet
 * order — which is how a component's `className` prop silently stops working.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
