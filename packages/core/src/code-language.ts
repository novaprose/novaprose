/**
 * A code block's language: only a safe name (Latin letters, digits, "+#._-", up to 32 characters): the value
 * goes into the `language-…` class and the Markdown fence, and JSON can bring anything.
 * A separate module: both the schema and the markdown entry point (without the schema) need it.
 */
export function codeLanguage(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_+#.-]{1,32}$/.test(value) ? value : null;
}
