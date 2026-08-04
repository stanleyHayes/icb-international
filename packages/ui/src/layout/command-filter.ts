/**
 * Command list logic for the CommandPalette — pure and unit-tested, so the component itself
 * only wires keyboard events to these functions.
 */

/** The minimum a command needs to be filterable. UI fields (icon, onSelect) extend this. */
export interface FilterableCommand {
  id: string;
  label: string;
  group?: string;
  keywords?: readonly string[];
}

export interface CommandGroup<T> {
  group: string | undefined;
  items: T[];
}

const RANK = {
  labelPrefix: 0,
  labelContains: 1,
  keywordMatch: 2,
  noMatch: -1,
} as const;

/**
 * Filter and rank commands against a query. Label prefix beats label substring beats keyword
 * match; ties keep the original order (stable), so results never jump around while typing.
 */
export function filterCommands<T extends FilterableCommand>(
  commands: readonly T[],
  query: string,
): T[] {
  const normalized = normalize(query);
  if (normalized === '') return [...commands];
  return commands
    .map((command, index) => ({ command, index, rank: rankCommand(command, normalized) }))
    .filter((entry) => entry.rank !== RANK.noMatch)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.command);
}

/** Group filtered commands by their `group` label, preserving first-seen order. */
export function groupCommands<T extends FilterableCommand>(
  commands: readonly T[],
): CommandGroup<T>[] {
  const groups: CommandGroup<T>[] = [];
  for (const command of commands) {
    const existing = groups.find((candidate) => candidate.group === command.group);
    if (existing) existing.items.push(command);
    else groups.push({ group: command.group, items: [command] });
  }
  return groups;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function rankCommand(command: FilterableCommand, query: string): number {
  const label = normalize(command.label);
  if (label.startsWith(query)) return RANK.labelPrefix;
  if (label.includes(query)) return RANK.labelContains;
  const keywords = command.keywords ?? [];
  if (keywords.some((keyword) => normalize(keyword).includes(query))) return RANK.keywordMatch;
  return RANK.noMatch;
}
