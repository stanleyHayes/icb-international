import { UnknownMacroVariableError } from './support-errors.js';

/**
 * Saved replies.
 *
 * A macro is a template with `{{variable}}` placeholders rendered against the ticket it is
 * applied to. Unknown variables fail loudly at render time — an agent sending "Hi {{custmerName}}"
 * to a customer is worse than an error message.
 */

export const MACRO_VARIABLES = ['customerName', 'ticketReference', 'agentName'] as const;
export type MacroVariable = (typeof MACRO_VARIABLES)[number];
export type MacroContext = Readonly<Record<MacroVariable, string>>;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;
const ALLOWED_VARIABLES: ReadonlySet<string> = new Set(MACRO_VARIABLES);

/** Variables the template references that are not in `MACRO_VARIABLES`. */
export function unknownVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1] ?? '';
    if (!ALLOWED_VARIABLES.has(name)) {
      found.add(name);
    }
  }
  return [...found];
}

/** Render a macro against a ticket context. Throws on unknown variables. */
export function renderMacro(template: string, context: MacroContext): string {
  const unknown = unknownVariables(template);
  if (unknown.length > 0) {
    throw new UnknownMacroVariableError(unknown);
  }
  return template.replace(VARIABLE_PATTERN, (raw, name: string) => {
    const value = context[name as MacroVariable];
    return typeof value === 'string' ? value : raw;
  });
}
