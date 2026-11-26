import type { Node as PMNode } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { lcs, tokenize } from './history-diff';
import { OWN, suggestTransaction, type SuggestionAuthor } from './suggestions';

/**
 * Правки ИИ — предложениями, как от соавтора. Переписанный текст сравнивается с исходным по словам:
 * меняются только изменённые слова (каждое — своя правка, принять или отклонить можно по одной),
 * неизменённые сохраняют оформление (жирный, ссылки, цвет). Атомы в тексте (упоминания, переменные)
 * сравниваются как слова: тронет их ИИ — их замена тоже будет предложением.
 */

export interface TextSegment {
  /** Начало и конец текста блока внутри диапазона. */
  from: number;
  to: number;
  text: string;
  /** Позиция в документе для каждого символа text (у атома все его символы — его позиция). */
  chars: number[];
}

/** Текстовые блоки в диапазоне — обрезанные по нему, с позицией каждого символа. */
export function textSegments(doc: PMNode, from: number, to: number): TextSegment[] {
  const segments: TextSegment[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const start = Math.max(from, pos + 1);
    const end = Math.min(to, pos + node.nodeSize - 1);
    let text = '';
    const chars: number[] = [];
    node.forEach((child, offset) => {
      const at = pos + 1 + offset;
      if (at + child.nodeSize <= start || at >= end) return;
      if (child.isText) {
        const value = child.text ?? '';
        for (let k = 0; k < value.length; k++) {
          const p = at + k;
          if (p >= start && p < end) {
            chars.push(p);
            text += value[k];
          }
        }
      } else if (child.isLeaf) {
        // Атом целиком внутри выделения — его текст (@Анна, {{client}}); перенос строки — \n.
        const leaf =
          child.type.name === 'hard_break' ? '\n' : (child.type.spec.leafText?.(child) ?? '￼');
        for (let k = 0; k < leaf.length; k++) chars.push(at);
        text += leaf;
      }
    });
    segments.push({ from: start, to: end, text, chars });
    return false;
  });
  return segments;
}

/** Текст диапазона для запроса к модели: абзацы через пустую строку. */
export function rangeText(doc: PMNode, from: number, to: number): string {
  return textSegments(doc, from, to)
    .map((segment) => segment.text)
    .join('\n\n');
}

/** Ответ модели → абзацы (одиночный перевод строки внутри абзаца — пробел). */
export function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p, index, all) => p || all.length === 1);
}

/** Замены изменённых слов одного блока — с конца, чтобы позиции начала оставались верными. */
function rewriteSegment(tr: Transaction, segment: TextSegment, next: string): void {
  const before = tokenize(segment.text);
  const after = tokenize(next);
  const pairs = lcs(before, after, (a, b) => a === b) ?? [];
  // Расхождения между совпавшими парами: старые [i0, i1) → новые [j0, j1).
  const hunks: Array<[number, number, number, number]> = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [before.length, after.length] as [number, number]]) {
    if (pi > i || pj > j) hunks.push([i, pi, j, pj]);
    i = pi + 1;
    j = pj + 1;
  }
  const offsets = [0];
  for (const token of before) offsets.push(offsets[offsets.length - 1]! + token.length);
  for (const [i0, i1, j0, j1] of hunks.reverse()) {
    const start = offsets[i0]!;
    const end = offsets[i1]!;
    const text = after.slice(j0, j1).join('');
    const from = start < segment.chars.length ? segment.chars[start]! : segment.to;
    const to = end > start ? segment.chars[end - 1]! + 1 : from;
    if (to > from && text) tr.insertText(text, from, to);
    else if (to > from) tr.delete(from, to);
    else if (text) tr.insertText(text, from);
  }
}

/**
 * Переписанный текст диапазона → шаги замены только изменённых слов. Абзацы ответа ложатся на блоки
 * по порядку; если их больше — лишние дописываются в последний блок, меньше — у блоков без пары
 * текст удаляется (структура документа не меняется — правки остаются текстовыми и отменяемыми).
 */
export function rewriteTransaction(
  state: EditorState,
  from: number,
  to: number,
  text: string,
): Transaction {
  const tr = state.tr;
  const segments = textSegments(state.doc, from, to);
  const next = paragraphs(text);
  const targets = segments.map((_, index) =>
    index < segments.length - 1 ? (next[index] ?? '') : next.slice(index).join(' '),
  );
  for (let index = segments.length - 1; index >= 0; index--)
    rewriteSegment(tr, segments[index]!, targets[index]!);
  return tr;
}

/** Правки ИИ к диапазону — предложениями от его имени. */
export function suggestRewrite(
  state: EditorState,
  from: number,
  to: number,
  text: string,
  author: SuggestionAuthor,
): Transaction {
  const tr = rewriteTransaction(state, from, to, text);
  if (!tr.docChanged) return tr;
  return suggestTransaction(tr, state, author).setMeta(OWN, true);
}

/**
 * Текст ИИ у позиции (продолжение, пересказ) — предложением; абзацы — новыми абзацами.
 * `newParagraph` — начать с нового абзаца (пересказ после выделенного). Посреди абзаца ответ встаёт
 * в этот абзац одной вставкой: разрыв абзаца правкой не отслеживается, и «отклонить» оставило бы
 * абзац разрезанным надвое.
 */
export function suggestInsert(
  state: EditorState,
  pos: number,
  text: string,
  author: SuggestionAuthor,
  { newParagraph = false } = {},
): Transaction {
  const tr = state.tr;
  let at = pos;
  const $pos = state.doc.resolve(pos);
  let parts = paragraphs(text);
  if (!newParagraph && pos < $pos.end()) parts = [parts.join(' ')];
  // Вплотную к слову — через пробел (модель часто начинает без него); так же перед словом после.
  const before = state.doc.textBetween(Math.max(0, pos - 1), pos, '\n', '￼');
  if (!newParagraph && parts[0] && before && !/\s$/.test(before) && /^[\p{L}\p{N}]/u.test(parts[0]))
    parts[0] = ` ${parts[0]}`;
  const after = state.doc.textBetween(pos, Math.min(pos + 1, $pos.end()), '\n', '￼');
  const last = parts.length - 1;
  if (!newParagraph && /\S$/.test(parts[last] ?? '') && /^[\p{L}\p{N}]/u.test(after))
    parts[last] += ' ';
  parts.forEach((paragraph, index) => {
    if (index > 0 || newParagraph) {
      tr.split(at);
      at += 2;
    }
    if (paragraph) {
      tr.insertText(paragraph, at);
      at += paragraph.length;
    }
  });
  if (!tr.docChanged) return tr;
  return suggestTransaction(tr, state, author).setMeta(OWN, true);
}
