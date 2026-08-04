import { ValidationError } from '../../../common/errors/index.js';

/**
 * `{{variable}}` substitution for notification template overrides.
 *
 * Pure and deliberately small: staff copy uses flat sample facts, and an unknown variable is a
 * validation failure listing every offending name — the same fail-loud rule the support macros
 * follow, because a template that silently ships `{{custmerName}}` to a customer is worse than
 * no template at all.
 */

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z]\w*)\s*\}\}/g;

/** Each unknown variable, once, in order of appearance. */
export function unknownVariables(template: string, sample: Readonly<Record<string, string>>): string[] {
  const unknown: string[] = [];
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1] ?? '';
    if (!(name in sample) && !unknown.includes(name)) {
      unknown.push(name);
    }
  }
  return unknown;
}

/** Replace every `{{variable}}` with its sample fact; throws on any unknown variable. */
export function renderTemplate(
  template: string,
  sample: Readonly<Record<string, string>>,
): string {
  const unknown = unknownVariables(template, sample);
  if (unknown.length > 0) {
    throw new ValidationError(
      'The template references unknown variables',
      unknown.map((name) => ({ path: name, message: `Unknown variable {{${name}}}` })),
    );
  }
  return template.replace(VARIABLE_PATTERN, (_match, name: string) => sample[name] ?? '');
}
