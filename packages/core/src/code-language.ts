/**
 * Язык блока кода — только безопасное имя (латиница, цифры, «+#._-», до 32 символов): значение
 * попадает в класс `language-…` и в забор Markdown, а из JSON может прийти что угодно.
 * Отдельный модуль: нужен и схеме, и точке входа markdown (без схемы).
 */
export function codeLanguage(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_+#.-]{1,32}$/.test(value) ? value : null;
}
