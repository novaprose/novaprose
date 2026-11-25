import {
  DOMParser,
  type ParseOptions,
  type Node as PMNode,
  type Schema,
  type Slice,
} from 'prosemirror-model';
import { schema } from './schema';

/** Атрибут, в который переносим фон ячейки до разбора (см. preprocessDOM). */
export const CELL_BG_ATTR = 'data-nova-cell-bg';

/**
 * Предобработка DOM перед разбором схемой — общая для setContent и вставки.
 *
 * Фон ячейки: правила стилей ProseMirror применяются к любому элементу, поэтому
 * `<td style="background-color">` иначе превратился бы ещё и в марку «маркер» на всём тексте ячейки.
 * Переносим значение в служебный атрибут и убираем из style.
 */
export function preprocessDOM(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    const bg = cell.style.backgroundColor;
    if (!bg) return;
    cell.setAttribute(CELL_BG_ATTR, bg);
    cell.style.removeProperty('background-color');
    if (!cell.getAttribute('style')) cell.removeAttribute('style');
  });
}

/** DOMParser схемы NovaProse с предобработкой: используется и для контента, и для буфера обмена. */
class NovaDOMParser extends DOMParser {
  override parse(dom: globalThis.Node, options?: ParseOptions): PMNode {
    preprocessDOM(dom as ParentNode);
    return super.parse(dom, options);
  }

  override parseSlice(dom: globalThis.Node, options?: ParseOptions): Slice {
    preprocessDOM(dom as ParentNode);
    return super.parseSlice(dom, options);
  }
}

const parsers = new WeakMap<Schema, NovaDOMParser>();

/** Парсер для схемы конкретного редактора (создаётся один раз на схему). */
export function parserFor(target: Schema): DOMParser {
  let parser = parsers.get(target);
  if (!parser) {
    parser = new NovaDOMParser(target, DOMParser.fromSchema(target).rules);
    parsers.set(target, parser);
  }
  return parser;
}

/** Парсер базовой схемы. */
export const novaParser = parserFor(schema);
