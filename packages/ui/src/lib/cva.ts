/**
 * The design system's variant helper.
 *
 * Re-exported through one module so every component resolves CVA from the same place; if the
 * implementation is ever swapped, only this file changes.
 */
export { cva, cx, type VariantProps } from 'class-variance-authority';
