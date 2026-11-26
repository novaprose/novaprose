import type { MarkSpec, NodeSpec, Schema } from 'prosemirror-model';

/**
 * Точка подключения правил элементов и атрибутов. Реализация — отдельный импорт
 * `@novaprose/core/html-rules` (~3 КБ gzip): нужна немногим, поэтому не входит в первую загрузку.
 *
 *   import { registerHtmlRules } from '@novaprose/core';
 *   import { htmlRules } from '@novaprose/core/html-rules';
 *   registerHtmlRules(htmlRules);
 */

export interface HtmlRulesOptions {
  /** Разрешены только эти элементы; атрибуты в [...] — полный список для элемента. */
  validElements?: string;
  /** Дополнительные элементы и атрибуты: 'div[class],h2[id],i[class],a[href|rel|data-*]'. */
  extendedValidElements?: string;
  /** Запрещённые элементы. */
  invalidElements?: string;
  /** Свои элементы: 'my-widget,~my-chip' (~ — строчный, как span; без ~ — блок, как div). */
  customElements?: string;
}

export interface SchemaSpecs {
  nodes: Record<string, NodeSpec>;
  marks: Record<string, MarkSpec>;
}

/** Правила одного редактора: меняют спеки схемы. */
export interface HtmlRulesInstance {
  /** Правила разрешают class у встроенного элемента — тогда классы сохраняются. */
  readonly classOnBuiltIn: boolean;
  /** Спеки с правилами; после создания схемы её нужно записать в `ref.schema`. */
  apply(specs: SchemaSpecs, ref: { schema?: Schema }): SchemaSpecs;
}

export interface HtmlRulesModule {
  create(options: HtmlRulesOptions): HtmlRulesInstance | null;
}

/** Служебный атрибут: сюда парсер переносит собственный style новых элементов (div, abbr…). */
export const OWN_STYLE = 'data-nova-own-style';

let registered: HtmlRulesModule | null = null;

/** Подключить правила элементов и атрибутов (один раз на страницу). */
export function registerHtmlRules(module: HtmlRulesModule): void {
  registered = module;
}

let warned = false;

/** Правила для опций редактора или null (опции не требуют правил / модуль не подключён). */
export function htmlRulesFor(options: HtmlRulesOptions): HtmlRulesInstance | null {
  const needed =
    !!options.extendedValidElements ||
    !!options.customElements ||
    /\[/.test(options.validElements ?? '');
  if (!needed) return null;
  if (!registered) {
    if (!warned) {
      warned = true;
      console.warn(
        "[nova] attribute lists, extendedValidElements and customElements need: import { htmlRules } from '@novaprose/core/html-rules'; registerHtmlRules(htmlRules);",
      );
    }
    return null;
  }
  return registered.create(options);
}
