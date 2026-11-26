import {
  getActiveAlign,
  getLinkAt,
  isMarkActive,
  isNodeActive,
  type CommandName,
} from '../commands';
import type { Editor } from '../editor';
import type { StyleFormat } from '../formats';
import type { MessageKey } from '../i18n';
import {
  getSelectedImage,
  hasImageCaption,
  openImageAltDialog,
  openImageDialog,
  setImageAttrs,
  setImageWidthFraction,
  toggleImageCaption,
} from '../image';
import { openLinkDialog, removeLink } from '../link';
import type { ImageAlign, MarkName, TextAlign } from '../schema';
import { getLineHeight, getStyle, setLineHeight, setStyle } from '../styles';
import { createColorPanel, defaultColors } from './color-panel';
import { registerTableUi } from './table-ui';
import { isFullscreen, openHelp, openPreview, openSourceCode, toggleFullscreen } from './views';
import { icons } from './icons';
import type { MenuEntry } from './menu';

export interface FontOption {
  label: string;
  value: string;
}

export const defaultFontFamilies: FontOption[] = [
  { label: 'Sans Serif', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, Menlo, Consolas, monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

export const defaultFontSizes = [
  '8pt',
  '10pt',
  '12pt',
  '14pt',
  '16pt',
  '18pt',
  '24pt',
  '36pt',
  '48pt',
];
export const defaultLineHeights = ['1', '1.15', '1.5', '2', '2.5', '3'];

const SHORTCUTS: Partial<Record<CommandName, string>> = {
  undo: 'Mod-z',
  redo: 'Mod-Shift-z',
  bold: 'Mod-b',
  italic: 'Mod-i',
  underline: 'Mod-u',
  strike: 'Mod-Shift-x',
  code: 'Mod-e',
  subscript: 'Mod-,',
  superscript: 'Mod-.',
  bulletList: 'Mod-Shift-8',
  orderedList: 'Mod-Shift-7',
  alignLeft: 'Mod-Shift-l',
  alignCenter: 'Mod-Shift-e',
  alignRight: 'Mod-Shift-r',
  alignJustify: 'Mod-Shift-j',
  indent: 'Mod-]',
  outdent: 'Mod-[',
  clearFormatting: 'Mod-\\',
  paragraph: 'Mod-Alt-0',
  h1: 'Mod-Alt-1',
  h2: 'Mod-Alt-2',
  h3: 'Mod-Alt-3',
  h4: 'Mod-Alt-4',
  h5: 'Mod-Alt-5',
  h6: 'Mod-Alt-6',
};

/** Вычисленный стиль текста под курсором — чтобы показывать реальный шрифт, а не «по умолчанию». */
function computedAtCursor(editor: Editor): CSSStyleDeclaration | null {
  try {
    const { node } = editor.view.domAtPos(editor.view.state.selection.from);
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    return el ? getComputedStyle(el) : null;
  } catch {
    return null;
  }
}

const GENERIC_FONTS: Record<string, string> = {
  'system-ui': 'Sans Serif',
  '-apple-system': 'Sans Serif',
  'sans-serif': 'Sans Serif',
  serif: 'Serif',
  monospace: 'Monospace',
  'ui-monospace': 'Monospace',
};

function prettyFontName(family: string): string {
  // Значение марки могло прийти из JSON не строкой.
  const first = String(family).split(',')[0]!.trim().replace(/["']/g, '');
  return GENERIC_FONTS[first.toLowerCase()] ?? first;
}

/** px → pt с округлением до 0.5 (12pt, 10.5pt), как в текстовых процессорах. */
function pxToPt(px: string): string | null {
  const value = parseFloat(px);
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value * 0.75 * 2) / 2}pt`;
}

/** Сравнение значений шрифта без учёта кавычек и пробелов. */
const sameFont = (a: string | null, b: string) =>
  typeof a === 'string' &&
  a.replace(/["'\s]/g, '').toLowerCase() === b.replace(/["'\s]/g, '').toLowerCase();

/**
 * Регистрирует все встроенные контролы. Имена — как в привычных конфигах тулбара
 * (bold, bullist, forecolor…), чтобы перенос существующих конфигов был тривиальным.
 */
export function registerBuiltins(editor: Editor): void {
  const { registry, t } = editor.ui;
  const state = () => editor.view.state;

  const commandButton = (
    name: string,
    command: CommandName,
    svg: string,
    isActive?: () => boolean,
  ) =>
    registry.addButton(name, {
      icon: svg,
      tooltip: t(command as MessageKey),
      ...(SHORTCUTS[command] ? { shortcut: SHORTCUTS[command] } : {}),
      onAction: (e) => e.exec(command),
      isEnabled: (e) => e.can(command),
      ...(isActive ? { isActive } : {}),
    });

  const markButton = (name: string, command: CommandName, mark: MarkName, svg: string) =>
    commandButton(name, command, svg, () => isMarkActive(state(), editor.schema.marks[mark]));

  commandButton('undo', 'undo', icons.undo);
  commandButton('redo', 'redo', icons.redo);
  markButton('bold', 'bold', 'bold', icons.bold);
  markButton('italic', 'italic', 'italic', icons.italic);
  markButton('underline', 'underline', 'underline', icons.underline);
  markButton('strikethrough', 'strike', 'strike', icons.strike);
  markButton('inlinecode', 'code', 'code', icons.code);
  markButton('subscript', 'subscript', 'subscript', icons.subscript);
  markButton('superscript', 'superscript', 'superscript', icons.superscript);
  commandButton('bullist', 'bulletList', icons.bulletList, () =>
    isNodeActive(state(), editor.schema.nodes.bullet_list),
  );
  commandButton('numlist', 'orderedList', icons.orderedList, () =>
    isNodeActive(state(), editor.schema.nodes.ordered_list),
  );
  commandButton('indent', 'indent', icons.indent);
  commandButton('outdent', 'outdent', icons.outdent);
  commandButton('blockquote', 'blockquote', icons.blockquote, () =>
    isNodeActive(state(), editor.schema.nodes.blockquote),
  );
  commandButton('codeblock', 'codeBlock', icons.codeBlock, () =>
    isNodeActive(state(), editor.schema.nodes.code_block),
  );
  commandButton('hr', 'horizontalRule', icons.horizontalRule);
  commandButton('removeformat', 'clearFormatting', icons.clearFormatting);

  const alignments: [CommandName, TextAlign, string][] = [
    ['alignLeft', 'left', icons.alignLeft],
    ['alignCenter', 'center', icons.alignCenter],
    ['alignRight', 'right', icons.alignRight],
    ['alignJustify', 'justify', icons.alignJustify],
  ];
  for (const [command, align, svg] of alignments) {
    commandButton(command.toLowerCase(), command, svg, () => getActiveAlign(state()) === align);
  }
  registry.addMenuButton('align', {
    icon: icons.alignLeft,
    tooltip: t('align'),
    isEnabled: (e) => e.can('alignLeft'),
    items: (e) =>
      alignments.map(([command, align, svg]) => ({
        id: command,
        label: t(command as MessageKey),
        icon: svg,
        ...(SHORTCUTS[command] ? { shortcut: SHORTCUTS[command] } : {}),
        active: getActiveAlign(e.view.state) === align,
        onSelect: () => e.exec(command),
      })),
  });

  // ---------- стиль блока ----------
  const blockItems: { command: CommandName; style: string }[] = [
    { command: 'paragraph', style: '' },
    { command: 'h1', style: 'font-size: 1.6em; font-weight: 700' },
    { command: 'h2', style: 'font-size: 1.35em; font-weight: 700' },
    { command: 'h3', style: 'font-size: 1.15em; font-weight: 700' },
    { command: 'h4', style: 'font-size: 1em; font-weight: 700' },
    { command: 'h5', style: 'font-size: 0.9em; font-weight: 700' },
    { command: 'h6', style: 'font-size: 0.85em; font-weight: 700' },
    { command: 'codeBlock', style: 'font-family: ui-monospace, monospace' },
  ];
  const currentBlock = (): CommandName => {
    const parent = state().selection.$from.parent;
    if (parent.type === editor.schema.nodes.heading) return `h${parent.attrs.level}` as CommandName;
    if (parent.type === editor.schema.nodes.code_block) return 'codeBlock';
    return 'paragraph';
  };
  // Отдельные кнопки заголовков (h1…h6): повторное нажатие возвращает обычный абзац.
  for (let level = 1; level <= 6; level++) {
    const command = `h${level}` as CommandName;
    registry.addToggleButton(command, {
      ...(level <= 3 ? { icon: icons[`h${level}` as 'h1' | 'h2' | 'h3'] } : { text: `H${level}` }),
      tooltip: t(command as MessageKey),
      ...(SHORTCUTS[command] ? { shortcut: SHORTCUTS[command] } : {}),
      isActive: () => currentBlock() === command,
      isEnabled: (e) => e.can(command) || currentBlock() === command,
      onAction: (e) => e.exec(currentBlock() === command ? 'paragraph' : command),
    });
  }

  // blockFormats: свой набор и порядок пунктов (block_formats в конфиге TinyMCE).
  const BLOCK_COMMANDS: Record<string, CommandName> = {
    p: 'paragraph',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    pre: 'codeBlock',
  };
  const blockList = (): { command: CommandName; style: string; label?: string }[] => {
    const custom = editor.options.blockFormats;
    if (!custom?.length) return blockItems;
    return custom.flatMap(({ label, block }) => {
      const command = BLOCK_COMMANDS[block];
      const item = blockItems.find((i) => i.command === command);
      return item ? [{ ...item, label }] : [];
    });
  };
  registry.addMenuButton('blocks', {
    tooltip: t('blocks'),
    label: () =>
      blockList().find((i) => i.command === currentBlock())?.label ??
      t(currentBlock() as MessageKey),
    minChars: 11,
    isEnabled: (e) => blockList().some(({ command }) => e.can(command)),
    items: (e) =>
      blockList()
        .filter(({ command }) => e.isAllowed(command))
        .map(({ command, style, label }) => ({
          id: command,
          label: label ?? t(command as MessageKey),
          labelStyle: style,
          ...(SHORTCUTS[command] ? { shortcut: SHORTCUTS[command] } : {}),
          active: currentBlock() === command,
          onSelect: () => e.exec(command),
        })),
  });

  // ---------- «Стили» (styles): форматы из styleFormats или стандартный набор ----------
  const ALIGN_SELECTOR = 'p,h1,h2,h3,h4,h5,h6';
  const defaultStyleFormats = (): StyleFormat[] => [
    {
      title: t('styles.headings'),
      items: ([1, 2, 3, 4, 5, 6] as const).map((level) => ({
        title: t(`h${level}` as MessageKey),
        block: `h${level}` as const,
      })),
    },
    {
      title: t('styles.inline'),
      items: [
        { title: t('bold'), inline: 'strong' },
        { title: t('italic'), inline: 'em' },
        { title: t('underline'), inline: 'u' },
        { title: t('strike'), inline: 's' },
        { title: t('superscript'), inline: 'sup' },
        { title: t('subscript'), inline: 'sub' },
        { title: t('code'), inline: 'code' },
      ],
    },
    {
      title: t('styles.blocks'),
      items: [
        { title: t('paragraph'), block: 'p' },
        { title: t('blockquote'), block: 'blockquote' },
        { title: t('codeBlock'), block: 'pre' },
      ],
    },
    {
      title: t('styles.align'),
      items: (['left', 'center', 'right', 'justify'] as const).map((align) => ({
        title: t(
          `align${align === 'justify' ? 'Justify' : align[0]!.toUpperCase() + align.slice(1)}` as MessageKey,
        ),
        selector: ALIGN_SELECTOR,
        styles: { 'text-align': align },
      })),
    },
  ];
  /** Формат пункта: ссылка на именованный или само описание. */
  const formatOf = (item: StyleFormat): string | StyleFormat => item.format ?? item;
  /** Превью в меню — только для того, что видно без CSS клиента. */
  const previewStyle = (item: StyleFormat): string => {
    const spec = item.format ? editor.formatter.get(item.format)?.[0] : item;
    const parts: string[] = [];
    const block = spec?.block;
    if (block && /^h[1-6]$/.test(block)) parts.push('font-weight: 700');
    if (spec?.inline === 'strong' || spec?.inline === 'b') parts.push('font-weight: 700');
    if (spec?.inline === 'em' || spec?.inline === 'i') parts.push('font-style: italic');
    if (spec?.inline === 'u') parts.push('text-decoration: underline');
    if (spec?.inline === 's' || spec?.inline === 'strike' || spec?.inline === 'del')
      parts.push('text-decoration: line-through');
    if (spec?.inline === 'code' || block === 'pre')
      parts.push('font-family: ui-monospace, monospace');
    for (const prop of ['color', 'background-color', 'font-family'] as const) {
      const value = spec?.styles?.[prop];
      if (value && /^[#\w\s,'"().%-]+$/.test(value)) parts.push(`${prop}: ${value}`);
    }
    return parts.join('; ');
  };
  const flatStyles = (items: StyleFormat[]): StyleFormat[] =>
    items.flatMap((item) => (item.items ? flatStyles(item.items) : [item]));
  const styleFormats = () => {
    const custom = editor.options.styleFormats;
    if (!custom) return defaultStyleFormats();
    return editor.options.styleFormatsMerge ? [...defaultStyleFormats(), ...custom] : custom;
  };
  registry.addMenuButton('styles', {
    tooltip: t('styles'),
    minChars: 10,
    label: (e) =>
      flatStyles(styleFormats()).find((item) => e.formatter.match(formatOf(item)))?.title ??
      t('styles'),
    items: (e) => {
      const entries: MenuEntry[] = [];
      const add = (items: StyleFormat[], prefix: string) => {
        items.forEach((item, index) => {
          if (item.items) {
            if (entries.length) entries.push({ type: 'separator' });
            entries.push({ type: 'heading', label: item.title });
            add(item.items, `${prefix}${index}-`);
            return;
          }
          entries.push({
            id: `style-${prefix}${index}`,
            label: item.title,
            labelStyle: previewStyle(item),
            active: e.formatter.match(formatOf(item)),
            // Формат по селектору без подходящих элементов (картинка не выделена) — неактивен.
            disabled: !e.formatter.canApply(formatOf(item)),
            onSelect: () => e.formatter.toggle(formatOf(item)),
          });
        });
      };
      add(styleFormats(), '');
      return entries;
    },
  });

  // ---------- шрифт, размер, интервал ----------
  const families = editor.options.fontFamilies ?? defaultFontFamilies;
  registry.addMenuButton('fontfamily', {
    tooltip: t('fontFamily'),
    minChars: 9,
    label: (e) => {
      const value = getStyle(state(), 'font_family');
      if (value)
        return families.find((f) => sameFont(value, f.value))?.label ?? prettyFontName(value);
      const computed = computedAtCursor(e)?.fontFamily;
      return computed ? prettyFontName(computed) : t('fontFamily');
    },
    items: (e) => {
      const value = getStyle(e.view.state, 'font_family');
      return [
        {
          id: 'default',
          label: t('default'),
          active: value === null,
          onSelect: () => e.exec(setStyle('font_family', null)),
        },
        { type: 'separator' },
        ...families.map<MenuEntry>((f) => ({
          id: f.label,
          label: f.label,
          labelStyle: `font-family: ${f.value}`,
          active: sameFont(value, f.value),
          onSelect: () => e.exec(setStyle('font_family', f.value)),
        })),
      ];
    },
  });

  const sizes = editor.options.fontSizes ?? defaultFontSizes;
  registry.addMenuButton('fontsize', {
    tooltip: t('fontSize'),
    minChars: 4,
    label: (e) =>
      getStyle(state(), 'font_size') ?? pxToPt(computedAtCursor(e)?.fontSize ?? '') ?? '—',
    items: (e) => {
      const value = getStyle(e.view.state, 'font_size');
      return [
        {
          id: 'default',
          label: t('default'),
          active: value === null,
          onSelect: () => e.exec(setStyle('font_size', null)),
        },
        { type: 'separator' },
        ...sizes.map<MenuEntry>((size) => ({
          id: size,
          label: size,
          active: value === size,
          onSelect: () => e.exec(setStyle('font_size', size)),
        })),
      ];
    },
  });

  const lineHeights = editor.options.lineHeights ?? defaultLineHeights;
  registry.addMenuButton('lineheight', {
    icon: icons.lineHeight,
    tooltip: t('lineHeight'),
    isEnabled: (e) => e.can(setLineHeight(null)),
    items: (e) => {
      const value = getLineHeight(e.view.state);
      return [
        {
          id: 'default',
          label: t('default'),
          active: value === null,
          onSelect: () => e.exec(setLineHeight(null)),
        },
        ...lineHeights.map<MenuEntry>((lh) => ({
          id: lh,
          label: lh,
          active: value === lh,
          onSelect: () => e.exec(setLineHeight(lh)),
        })),
      ];
    },
  });

  // ---------- цвета ----------
  const colorButton = (
    name: string,
    mark: 'color' | 'background',
    svg: string,
    label: MessageKey,
  ) =>
    registry.addPanelButton(name, {
      icon: svg,
      tooltip: t(label),
      indicator: () => getStyle(state(), mark),
      render: (e, close) =>
        createColorPanel({
          colors: e.options.colors ?? defaultColors,
          current: getStyle(e.view.state, mark),
          label: t(label),
          removeLabel: t('removeColor'),
          customLabel: t('customColor'),
          onPick: (color) => {
            close();
            e.exec(setStyle(mark, color));
          },
        }),
    });
  colorButton('forecolor', 'color', icons.textColor, 'textColor');
  colorButton('backcolor', 'background', icons.highlight, 'backgroundColor');

  // ---------- «Ещё формат»: редкие марки, чтобы не раздувать тулбар (как в Google Docs) ----------
  const extraMarks: [CommandName, MarkName, string][] = [
    ['superscript', 'superscript', icons.superscript],
    ['subscript', 'subscript', icons.subscript],
    ['code', 'code', icons.code],
  ];
  registry.addMenuButton('moreformats', {
    icon: icons.formatMore,
    tooltip: t('moreFormats'),
    isActive: (e) =>
      extraMarks.some(([, mark]) => isMarkActive(e.view.state, editor.schema.marks[mark])),
    items: (e) => [
      ...extraMarks
        .filter(([command]) => e.isAllowed(command))
        .map<MenuEntry>(([command, mark, svg]) => ({
          id: command,
          label: t(command as MessageKey),
          icon: svg,
          checkbox: true,
          active: isMarkActive(e.view.state, editor.schema.marks[mark]),
          disabled: !e.can(command),
          ...(SHORTCUTS[command] ? { shortcut: SHORTCUTS[command] } : {}),
          onSelect: () => e.exec(command),
        })),
      { type: 'separator' },
      {
        id: 'clearFormatting',
        label: t('clearFormatting'),
        icon: icons.clearFormatting,
        disabled: !e.can('clearFormatting'),
        shortcut: SHORTCUTS.clearFormatting!,
        onSelect: () => e.exec('clearFormatting'),
      },
      {
        id: 'pasteAsText',
        label: t('pasteAsText'),
        icon: icons.pasteText,
        checkbox: true,
        active: e.isPasteAsText(),
        onSelect: () => {
          e.setPasteAsText(!e.isPasteAsText());
          e.focus();
        },
      },
    ],
  });

  registry.addToggleButton('pastetext', {
    icon: icons.pasteText,
    tooltip: t('pasteAsText'),
    isActive: (e) => e.isPasteAsText(),
    onAction: (e) => {
      e.setPasteAsText(!e.isPasteAsText());
      e.focus();
    },
  });

  // ---------- ссылки и картинки ----------
  registry.addButton('link', {
    icon: icons.link,
    tooltip: t('link'),
    shortcut: 'Mod-k',
    onAction: (e) => openLinkDialog(e),
    isActive: () => !!getLinkAt(state()),
  });
  registry.addButton('unlink', {
    icon: icons.unlink,
    tooltip: t('unlink'),
    onAction: (e) => e.exec(removeLink()),
    isEnabled: (e) => e.can(removeLink()),
  });
  registry.addButton('image', {
    icon: icons.image,
    tooltip: t('image'),
    onAction: (e) => openImageDialog(e),
  });

  // ---------- контекстный тулбар картинки ----------
  const imageAlign = () => getSelectedImage(state())?.attrs.align ?? null;
  const imageAlignButton = (name: string, align: ImageAlign, svg: string, label: MessageKey) =>
    registry.addToggleButton(name, {
      icon: svg,
      tooltip: t(label),
      isActive: () => imageAlign() === align,
      // Повторное нажатие снимает выравнивание — картинка снова «в строке».
      onAction: (e) => e.exec(setImageAttrs({ align: imageAlign() === align ? null : align })),
    });
  imageAlignButton('imagealignleft', 'left', icons.imageLeft, 'image.alignLeft');
  imageAlignButton('imagealigncenter', 'center', icons.imageCenter, 'image.alignCenter');
  imageAlignButton('imagealignright', 'right', icons.imageRight, 'image.alignRight');

  const imageSizes: [MessageKey, number | null][] = [
    ['image.sizeSmall', 0.25],
    ['image.sizeMedium', 0.5],
    ['image.sizeLarge', 0.75],
    ['image.sizeFull', 1],
    ['image.sizeOriginal', null],
  ];
  registry.addMenuButton('imagesize', {
    icon: icons.resize,
    tooltip: t('image.size'),
    items: (e) =>
      imageSizes.map<MenuEntry>(([label, fraction]) => ({
        id: label,
        label: t(label),
        onSelect: () => setImageWidthFraction(e, fraction),
      })),
  });
  registry.addButton('imagealt', {
    icon: icons.altText,
    tooltip: t('image.editAlt'),
    onAction: (e) => openImageAltDialog(e),
  });
  registry.addToggleButton('imagecaption', {
    icon: icons.imageCaption,
    tooltip: t('image.caption'),
    isActive: (e) => hasImageCaption(e.view.state),
    onAction: (e) => e.exec(toggleImageCaption),
  });
  registry.addButton('imagedelete', {
    icon: icons.trash,
    tooltip: t('image.delete'),
    onAction: (e) =>
      e.exec((s, dispatch) => {
        // По позиции, а не по выделению: курсор может стоять в подписи.
        const image = getSelectedImage(s);
        if (!image) return false;
        dispatch?.(s.tr.delete(image.pos, image.pos + image.node.nodeSize).scrollIntoView());
        return true;
      }),
  });
  registerTableUi(editor);

  // ---------- поиск, режимы просмотра, справка ----------
  registry.addButton('searchreplace', {
    icon: icons.search,
    tooltip: t('search.title'),
    shortcut: 'Mod-f',
    onAction: (e) => e.openSearch(),
  });
  registry.addToggleButton('fullscreen', {
    icon: icons.fullscreen,
    tooltip: t('fullscreen'),
    shortcut: 'Mod-Shift-f',
    isActive: (e) => isFullscreen(e),
    onAction: (e) => toggleFullscreen(e),
  });
  registry.addButton('preview', {
    icon: icons.preview,
    tooltip: t('preview'),
    onAction: (e) => openPreview(e),
  });
  registry.addButton('code', {
    icon: icons.sourceCode,
    tooltip: t('sourceCode'),
    onAction: (e) => openSourceCode(e),
  });
  registry.addButton('help', {
    icon: icons.help,
    tooltip: t('help'),
    shortcut: 'Alt-0',
    onAction: (e) => openHelp(e),
  });

  registry.addContextToolbar('image', {
    label: t('image.toolbar'),
    predicate: (e) => !!getSelectedImage(e.view.state),
    items:
      'imagealignleft imagealigncenter imagealignright | imagesize imagealt imagecaption | imagedelete',
    // Над картинкой (и с подписью — над всей figure, даже когда курсор в подписи).
    anchor: (e) => {
      const image = getSelectedImage(e.view.state);
      const dom = image ? (e.view.nodeDOM(image.pos) as HTMLElement | null) : null;
      return dom?.getBoundingClientRect() ?? null;
    },
  });
}
