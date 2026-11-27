/**
 * Renamed parts of the public API keep working: an old option, command or event name is mapped to the
 * new one, and the console says so once per page, naming the replacement. From 1.0 an old name stays for
 * at least one minor version (https://novaprose.com/project/versioning/). The tables below are empty
 * until something is renamed; a rename adds one line here and a line in the changelog.
 */

export interface Renames {
  options: Record<string, string>;
  commands: Record<string, string>;
  events: Record<string, string>;
}

/** What has been renamed: old name → new name. */
export const RENAMED: Renames = { options: {}, commands: {}, events: {} };

const KIND: Record<keyof Renames, string> = {
  options: 'the option',
  commands: 'the command',
  events: 'the event',
};

const warned = new Set<string>();

/** Logs once per page that something is deprecated and what to use instead. */
export function deprecate(what: string, instead: string): void {
  if (warned.has(what)) return;
  warned.add(what);
  console.warn(
    `[nova] ${what} is deprecated: use ${instead}. Old names keep working for at least one minor version (https://novaprose.com/project/versioning/).`,
  );
}

const own = (table: Record<string, string>, key: string) =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

/** The current name of an option, command or event: a renamed one is mapped, with a warning. */
export function currentName(kind: keyof Renames, name: string, renamed: Renames = RENAMED): string {
  const next = own(renamed[kind], name);
  if (next === undefined) return name;
  deprecate(`${KIND[kind]} "${name}"`, `"${next}"`);
  return next;
}

/** Options with renamed keys moved to their new names. A new name given as well wins. */
export function renameOptions<T extends object>(options: T, renamed: Renames = RENAMED): T {
  let result = options as Record<string, unknown>;
  for (const [old, next] of Object.entries(renamed.options)) {
    if (!Object.prototype.hasOwnProperty.call(options, old)) continue;
    deprecate(`${KIND.options} "${old}"`, `"${next}"`);
    if (result === options) result = { ...result };
    if (!Object.prototype.hasOwnProperty.call(result, next)) result[next] = result[old];
    delete result[old];
  }
  return result as T;
}
