import {
  DOMParser,
  type ParseOptions,
  type Node as PMNode,
  type Schema,
  type Slice,
} from 'prosemirror-model';
import { OWN_STYLE } from './html-rules-api';
import { schema } from './schema';

/** Атрибут, в который переносим фон ячейки до разбора (см. preprocessDOM). */
export const CELL_BG_ATTR = 'data-nova-cell-bg';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/**
 * MathML и SVG схема не поддерживает. Внутри них встречаются элементы с именами HTML-тегов
 * (`<math><td>`), но без `style` и прочего HTML-API — правила разбора на них падали.
 * Формулу (MathML, в т.ч. из Word) заменяем её текстом, чтобы текст не пропал; SVG убираем.
 * Найдено property-based тестом (packages/core/test/security.property.test.ts).
 */
function replaceForeignElements(root: ParentNode): void {
  const foreign = [...root.querySelectorAll('*')].filter(
    // Только самые внешние: родитель — HTML-элемент или сам фрагмент (parentElement = null).
    (el) => el.namespaceURI !== HTML_NS && (el.parentElement?.namespaceURI ?? HTML_NS) === HTML_NS,
  );
  for (const el of foreign) {
    const text = el.namespaceURI === MATHML_NS ? (el.textContent ?? '') : '';
    el.replaceWith(el.ownerDocument.createTextNode(text));
  }
}

/**
 * Предобработка DOM перед разбором схемой — общая для setContent и вставки.
 *
 * Фон ячейки: правила стилей ProseMirror применяются к любому элементу, поэтому
 * `<td style="background-color">` иначе превратился бы ещё и в марку «маркер» на всём тексте ячейки.
 * Переносим значение в служебный атрибут и убираем из style.
 */
export function preprocessDOM(root: ParentNode): void {
  replaceForeignElements(root);
  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    // Внутри <math>/<svg> «td» — элемент чужого пространства имён, у него может не быть style.
    if (!cell.style) return;
    const bg = cell.style.backgroundColor;
    if (!bg) return;
    cell.setAttribute(CELL_BG_ATTR, bg);
    cell.style.removeProperty('background-color');
    if (!cell.getAttribute('style')) cell.removeAttribute('style');
  });
}

/**
 * DOMParser схемы NovaProse с предобработкой: используется и для контента, и для буфера обмена.
 *
 * Узлы с `ignoreStyles: true` в спеке (переменная шаблона — нередактируемая «фишка») не должны
 * получать марки из собственного style: ProseMirror читает стили элемента раньше, чем узнаёт,
 * что это целый узел. Поэтому у таких элементов style снимается до разбора.
 */
class NovaDOMParser extends DOMParser {
  private atomSelector: string | undefined;
  private ownStyleSelector: string | undefined;

  private prepare(dom: globalThis.Node): void {
    preprocessDOM(dom as ParentNode);
    // Элементы из extendedValidElements (div, abbr…) хранят style сами. Иначе ProseMirror превратил бы
    // его ещё и в марки оформления содержимого — и стиль удваивался бы при каждом сохранении.
    this.ownStyleSelector ??= Object.values(this.schema.nodes)
      .flatMap((type) => (type.spec as { ownStyleTags?: string[] }).ownStyleTags ?? [])
      .join(', ');
    if (this.ownStyleSelector && 'querySelectorAll' in dom) {
      (dom as ParentNode).querySelectorAll(this.ownStyleSelector).forEach((el) => {
        const style = el.getAttribute('style');
        if (style === null) return;
        el.setAttribute(OWN_STYLE, style);
        el.removeAttribute('style');
      });
    }
    this.atomSelector ??= Object.values(this.schema.nodes)
      .filter((type) => (type.spec as { ignoreStyles?: boolean }).ignoreStyles)
      .flatMap((type) => (type.spec.parseDOM ?? []).map((rule) => rule.tag))
      .filter((tag): tag is string => !!tag)
      .join(', ');
    if (!this.atomSelector || !('querySelectorAll' in dom)) return;
    (dom as ParentNode).querySelectorAll(this.atomSelector).forEach((el) => {
      el.removeAttribute('style');
    });
  }

  override parse(dom: globalThis.Node, options?: ParseOptions): PMNode {
    this.prepare(dom);
    return super.parse(dom, options);
  }

  override parseSlice(dom: globalThis.Node, options?: ParseOptions): Slice {
    this.prepare(dom);
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
