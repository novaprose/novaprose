import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import { insertText, openSymbolDialog, pickLabels, symbolPanel, type SymbolGroup } from './shared';

/** Плагин charmap: таблица специальных символов с поиском. `plugins: ['charmap']`. */

const ICON = icons.charmap;

const LABELS = {
  en: {
    title: 'Special character',
    search: 'Search characters',
    empty: 'Nothing found',
    groups: ['Currency', 'Typography', 'Math', 'Arrows', 'Latin', 'Greek'],
  },
  ru: {
    title: 'Специальный символ',
    search: 'Поиск символа',
    empty: 'Ничего не найдено',
    groups: ['Валюты', 'Типографика', 'Математика', 'Стрелки', 'Латиница', 'Греческие'],
  },
};

// Названия — английские: по ним работает поиск на любом языке интерфейса.
const SYMBOLS: (readonly (readonly [string, string])[])[] = [
  [
    ['€', 'euro'],
    ['£', 'pound'],
    ['¥', 'yen'],
    ['₽', 'ruble'],
    ['$', 'dollar'],
    ['¢', 'cent'],
    ['₴', 'hryvnia'],
    ['₸', 'tenge'],
    ['₹', 'rupee'],
    ['₩', 'won'],
    ['₺', 'lira'],
    ['₿', 'bitcoin'],
  ],
  [
    ['—', 'em dash'],
    ['–', 'en dash'],
    ['…', 'ellipsis'],
    ['«', 'left guillemet'],
    ['»', 'right guillemet'],
    ['„', 'low double quote'],
    ['“', 'left double quote'],
    ['”', 'right double quote'],
    ['‘', 'left single quote'],
    ['’', 'right single quote apostrophe'],
    ['•', 'bullet'],
    ['·', 'middle dot'],
    ['§', 'section'],
    ['¶', 'paragraph pilcrow'],
    ['†', 'dagger'],
    ['‡', 'double dagger'],
    ['©', 'copyright'],
    ['®', 'registered'],
    ['™', 'trademark'],
    ['°', 'degree'],
    ['№', 'numero number'],
    ['‰', 'per mille'],
    ['′', 'prime minutes'],
    ['″', 'double prime seconds'],
    ['¡', 'inverted exclamation'],
    ['¿', 'inverted question'],
  ],
  [
    ['±', 'plus minus'],
    ['×', 'multiply times'],
    ['÷', 'divide'],
    ['≠', 'not equal'],
    ['≈', 'approximately'],
    ['≤', 'less or equal'],
    ['≥', 'greater or equal'],
    ['∞', 'infinity'],
    ['√', 'square root'],
    ['∑', 'sum sigma'],
    ['∏', 'product'],
    ['∫', 'integral'],
    ['∂', 'partial'],
    ['∆', 'increment delta'],
    ['∈', 'element of'],
    ['∉', 'not element of'],
    ['∩', 'intersection'],
    ['∪', 'union'],
    ['⊂', 'subset'],
    ['∀', 'for all'],
    ['∃', 'exists'],
    ['¬', 'not'],
    ['∧', 'and'],
    ['∨', 'or'],
    ['½', 'one half'],
    ['⅓', 'one third'],
    ['¼', 'one quarter'],
    ['¾', 'three quarters'],
    ['²', 'superscript two squared'],
    ['³', 'superscript three cubed'],
    ['µ', 'micro'],
    ['‰', 'per mille'],
  ],
  [
    ['←', 'left arrow'],
    ['→', 'right arrow'],
    ['↑', 'up arrow'],
    ['↓', 'down arrow'],
    ['↔', 'left right arrow'],
    ['↕', 'up down arrow'],
    ['⇐', 'left double arrow'],
    ['⇒', 'right double arrow implies'],
    ['⇔', 'left right double arrow iff'],
    ['↩', 'return arrow'],
    ['↗', 'north east arrow'],
    ['↘', 'south east arrow'],
  ],
  [
    ['à', 'a grave'],
    ['á', 'a acute'],
    ['â', 'a circumflex'],
    ['ä', 'a umlaut'],
    ['å', 'a ring'],
    ['æ', 'ae ligature'],
    ['ç', 'c cedilla'],
    ['é', 'e acute'],
    ['è', 'e grave'],
    ['ê', 'e circumflex'],
    ['ë', 'e umlaut'],
    ['í', 'i acute'],
    ['ï', 'i umlaut'],
    ['ñ', 'n tilde'],
    ['ó', 'o acute'],
    ['ô', 'o circumflex'],
    ['ö', 'o umlaut'],
    ['ø', 'o slash'],
    ['œ', 'oe ligature'],
    ['ß', 'sharp s eszett'],
    ['ú', 'u acute'],
    ['ü', 'u umlaut'],
    ['ý', 'y acute'],
    ['ł', 'l stroke'],
    ['š', 's caron'],
    ['ž', 'z caron'],
  ],
  [
    ['α', 'alpha'],
    ['β', 'beta'],
    ['γ', 'gamma'],
    ['δ', 'delta'],
    ['ε', 'epsilon'],
    ['θ', 'theta'],
    ['λ', 'lambda'],
    ['μ', 'mu'],
    ['π', 'pi'],
    ['σ', 'sigma'],
    ['φ', 'phi'],
    ['ω', 'omega'],
    ['Δ', 'capital delta'],
    ['Σ', 'capital sigma'],
    ['Ω', 'capital omega ohm'],
  ],
];

export default definePlugin({
  name: 'charmap',
  toolbar: 'charmap',
  setup(editor) {
    const labels = pickLabels(editor, LABELS);
    const groups: SymbolGroup[] = SYMBOLS.map((items, i) => ({ title: labels.groups[i]!, items }));
    const panel = (close: () => void) =>
      symbolPanel({
        groups,
        searchLabel: labels.search,
        emptyText: labels.empty,
        className: 'nova-charmap',
        onPick: (symbol) => {
          close();
          insertText(editor, symbol);
        },
      });

    editor.ui.registry.addPanelButton('charmap', {
      icon: ICON,
      tooltip: labels.title,
      isEnabled: (e) => e.isEditable(),
      render: (_e, close) => panel(close),
    });
    editor.ui.registry.addMenuItem('charmap', {
      text: labels.title,
      icon: ICON,
      onAction: () => openSymbolDialog(editor, labels.title, panel),
    });
  },
});
