/**
 * Собственный набор иконок NovaProse (24×24, stroke). Рисуем сами — никаких иконок Tiny (clean-room).
 */
const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  bold: svg('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
  italic: svg('<path d="M14 5h-4M14 19h-4M14 5l-4 14"/>'),
  underline: svg('<path d="M7 4v6a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>'),
  strike: svg(
    '<path d="M4 12h16"/><path d="M16 7a4 3 0 0 0-4-2c-2.5 0-4 1.3-4 3"/><path d="M8 17a4 3 0 0 0 4 2c2.5 0 4-1.3 4-3"/>',
  ),
  code: svg('<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>'),
  subscript: svg(
    '<path d="m4 6 8 9M12 6l-8 9"/><path d="M20 20h-4c0-1.5 4-2 4-4a1.5 1.5 0 0 0-3-.5"/>',
  ),
  superscript: svg(
    '<path d="m4 9 8 9M12 9l-8 9"/><path d="M20 10h-4c0-1.5 4-2 4-4a1.5 1.5 0 0 0-3-.5"/>',
  ),
  bulletList: svg(
    '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h11"/>',
  ),
  orderedList: svg(
    '<path d="M4 5h1v4M4 9h2"/><path d="M4 14h2l-2 3h2"/><path d="M10 7h10M10 12h10M10 17h10"/>',
  ),
  indent: svg('<path d="M4 6h16M10 12h10M4 18h16"/><path d="m4 10 3 2-3 2"/>'),
  outdent: svg('<path d="M4 6h16M10 12h10M4 18h16"/><path d="m7 10-3 2 3 2"/>'),
  blockquote: svg(
    '<path d="M6 17c-1.5 0-2.5-1-2.5-3 0-3 2-6 5-7"/><path d="M15 17c-1.5 0-2.5-1-2.5-3 0-3 2-6 5-7"/><circle cx="6" cy="14" r="2.5"/><circle cx="15" cy="14" r="2.5"/>',
  ),
  codeBlock: svg(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m9 10-2 2 2 2M15 10l2 2-2 2"/>',
  ),
  alignLeft: svg('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
  alignCenter: svg('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
  alignRight: svg('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
  alignJustify: svg('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>'),
  horizontalRule: svg('<path d="M4 12h16"/><path d="M8 7h8M8 17h8" opacity=".4"/>'),
  link: svg(
    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ),
  unlink: svg(
    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/><path d="M3 3l18 18"/>',
  ),
  image: svg(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  ),
  clearFormatting: svg('<path d="M6 5h12M12 5l-3 14"/><path d="m15 15 5 5M20 15l-5 5"/>'),
  // «T²» — меню дополнительного форматирования
  formatMore: svg(
    '<path d="M3 7h10M8 7v12"/><path d="M21 11h-4c0-1.5 4-2 4-4a1.5 1.5 0 0 0-3-.5"/>',
  ),
  // Картинка: обтекание слева / по центру / справа — прямоугольник + строки текста
  imageLeft: svg(
    '<rect x="3" y="5" width="8" height="8" rx="1"/><path d="M14 6h7M14 10h7M3 17h18M3 20h12"/>',
  ),
  imageCenter: svg('<rect x="7" y="4" width="10" height="9" rx="1"/><path d="M3 17h18M6 20h12"/>'),
  imageRight: svg(
    '<rect x="13" y="5" width="8" height="8" rx="1"/><path d="M3 6h7M3 10h7M3 17h18M9 20h12"/>',
  ),
  resize: svg('<path d="M15 3h6v6M9 21H3v-6"/><path d="m21 3-7 7M3 21l7-7"/>'),
  altText: svg(
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15l2.5-6 2.5 6M7.8 13h3.4M15 9v6h3"/>',
  ),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  paragraph: svg('<path d="M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>'),
  h1: svg('<path d="M4 6v12M12 6v12M4 12h8"/><path d="m16 9 3-2v11"/>'),
  h2: svg(
    '<path d="M4 6v12M12 6v12M4 12h8"/><path d="M16 9.5a2.5 2.5 0 1 1 5 .5c0 1.5-5 4-5 8h5"/>',
  ),
  h3: svg('<path d="M4 6v12M12 6v12M4 12h8"/><path d="M16 7.5h4.5l-2.5 3.5a3 3 0 1 1-2.5 5"/>'),
  // Планшет буфера обмена с буквой T — «вставить как текст»
  pasteText: svg(
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M12 10v7"/>',
  ),
  // ---------- таблицы ----------
  table: svg(
    '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  ),
  rowBefore: svg('<rect x="3" y="12" width="18" height="8" rx="1"/><path d="M12 3v6M9 6h6"/>'),
  rowAfter: svg('<rect x="3" y="4" width="18" height="8" rx="1"/><path d="M12 15v6M9 18h6"/>'),
  rowDelete: svg(
    '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="m10 10 4 4M14 10l-4 4"/>',
  ),
  colBefore: svg('<rect x="12" y="3" width="8" height="18" rx="1"/><path d="M3 12h6M6 9v6"/>'),
  colAfter: svg('<rect x="4" y="3" width="8" height="18" rx="1"/><path d="M15 12h6M18 9v6"/>'),
  colDelete: svg(
    '<rect x="8" y="3" width="8" height="18" rx="1"/><path d="m10 10 4 4M14 10l-4 4"/>',
  ),
  merge: svg(
    '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M6 12h4M14 12h4M8 10l2 2-2 2M16 10l-2 2 2 2"/>',
  ),
  split: svg(
    '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M5 12h4M15 12h4M7 10l-2 2 2 2M17 10l2 2-2 2"/>',
  ),
  rowHeader: svg(
    '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18"/><path d="M4 5h16v4H4z" fill="currentColor" opacity=".35" stroke="none"/>',
  ),
  colHeader: svg(
    '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9.5 4v16"/><path d="M4 5h5v14H4z" fill="currentColor" opacity=".35" stroke="none"/>',
  ),
  sort: svg('<path d="M7 4v16M4 17l3 3 3-3"/><path d="M14 6h7M14 11h5M14 16h3"/>'),
  tableProps: svg(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/><path d="M15 15h3"/>',
  ),
  cellProps: svg(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/><rect x="11" y="12" width="8" height="6" rx="1"/>',
  ),
  tableDelete: svg(
    '<rect x="3" y="4" width="13" height="12" rx="1"/><path d="M3 10h13M9.5 4v12"/><path d="m17 15 4 4M21 15l-4 4"/>',
  ),
  chevronUp: svg('<path d="m7 14 5-5 5 5"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  fullscreen: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  fullscreenExit: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  preview: svg(
    '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ),
  sourceCode: svg('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
  help: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  ),
  print: svg(
    '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  ),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevronDown: svg('<path d="m7 10 5 5 5-5"/>'),
  more: svg(
    '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
  ),
  // Буква «A» — цвет полоски под ней задаётся через currentColor у .nova-color-bar
  textColor: svg('<path d="m6 16 6-12 6 12"/><path d="M8.5 11h7"/>'),
  highlight: svg('<path d="m14 4 6 6-8 8H6v-6z"/><path d="m11 7 6 6"/>'),
  lineHeight: svg(
    '<path d="M11 6h10M11 12h10M11 18h10"/><path d="m3 8 3-3 3 3M3 16l3 3 3-3M6 5v14"/>',
  ),
  upload: svg(
    '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  ),
  externalLink: svg(
    '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  ),
  copy: svg(
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  ),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>'),
} as const;

export type IconName = keyof typeof icons;
