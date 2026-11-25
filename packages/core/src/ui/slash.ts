import type { CommandName } from '../commands';
import type { Editor } from '../editor';
import type { MessageKey } from '../i18n';
import { openImageDialog } from '../image';
import { openLinkDialog } from '../link';
import { insertTable } from '../table';
import type { AutocompleterItem } from './autocompleter';
import { icons } from './icons';

export interface SlashCommand {
  name: string;
  /** Ключ перевода подписи. */
  label: MessageKey;
  icon: string;
  /** Доп. слова для поиска (английские — чтобы «/h1» и «/quote» работали в любом языке UI). */
  keywords: string[];
  shortcut?: string;
  run: (editor: Editor) => void;
}

const exec = (command: CommandName) => (editor: Editor) => editor.exec(command);

export const defaultSlashCommands: SlashCommand[] = [
  {
    name: 'paragraph',
    label: 'paragraph',
    icon: icons.paragraph,
    keywords: ['text', 'p', 'paragraph'],
    run: exec('paragraph'),
  },
  {
    name: 'h1',
    label: 'h1',
    icon: icons.h1,
    keywords: ['h1', 'heading', 'title'],
    shortcut: 'Mod-Alt-1',
    run: exec('h1'),
  },
  {
    name: 'h2',
    label: 'h2',
    icon: icons.h2,
    keywords: ['h2', 'heading', 'subtitle'],
    shortcut: 'Mod-Alt-2',
    run: exec('h2'),
  },
  {
    name: 'h3',
    label: 'h3',
    icon: icons.h3,
    keywords: ['h3', 'heading'],
    shortcut: 'Mod-Alt-3',
    run: exec('h3'),
  },
  {
    name: 'bullist',
    label: 'bulletList',
    icon: icons.bulletList,
    keywords: ['ul', 'list', 'bullet'],
    shortcut: 'Mod-Shift-8',
    run: exec('bulletList'),
  },
  {
    name: 'numlist',
    label: 'orderedList',
    icon: icons.orderedList,
    keywords: ['ol', 'list', 'numbered'],
    shortcut: 'Mod-Shift-7',
    run: exec('orderedList'),
  },
  {
    name: 'blockquote',
    label: 'blockquote',
    icon: icons.blockquote,
    keywords: ['quote', 'blockquote', 'citation'],
    run: exec('blockquote'),
  },
  {
    name: 'codeblock',
    label: 'codeBlock',
    icon: icons.codeBlock,
    keywords: ['code', 'pre', 'snippet'],
    run: exec('codeBlock'),
  },
  {
    name: 'hr',
    label: 'horizontalRule',
    icon: icons.horizontalRule,
    keywords: ['hr', 'divider', 'line', 'separator'],
    run: exec('horizontalRule'),
  },
  {
    name: 'table',
    label: 'table',
    icon: icons.table,
    keywords: ['table', 'grid'],
    run: (e) => e.exec(insertTable(3, 3)),
  },
  {
    name: 'image',
    label: 'image',
    icon: icons.image,
    keywords: ['image', 'picture', 'photo', 'img'],
    run: (e) => openImageDialog(e),
  },
  {
    name: 'link',
    label: 'link',
    icon: icons.link,
    keywords: ['link', 'url', 'href'],
    shortcut: 'Mod-k',
    run: (e) => openLinkDialog(e),
  },
];

/**
 * Ранжирование: совпадение с начала подписи важнее совпадения с начала ключевого слова,
 * а то — важнее вхождения в середину. Пустой запрос — все команды по порядку.
 */
export function rankSlashCommands(
  commands: SlashCommand[],
  query: string,
  t: (k: MessageKey) => string,
): SlashCommand[] {
  const q = query.toLowerCase();
  if (!q) return commands;
  const scored: [number, number, SlashCommand][] = [];
  commands.forEach((cmd, index) => {
    const label = t(cmd.label).toLowerCase();
    const words = [label, ...label.split(/\s+/), ...cmd.keywords];
    let score = -1;
    if (label.startsWith(q)) score = 3;
    else if (words.some((w) => w.startsWith(q))) score = 2;
    else if (words.some((w) => w.includes(q))) score = 1;
    if (score > 0) scored.push([score, index, cmd]);
  });
  return scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, , cmd]) => cmd);
}

/** Регистрирует автокомплитер «/» со стандартными командами (плюс пользовательские через опцию). */
export function registerSlashCommands(editor: Editor, extra: SlashCommand[] = []): void {
  const { t } = editor.ui;
  const commands = [...defaultSlashCommands, ...extra].filter((cmd) => editor.isAllowed(cmd.name));
  editor.ui.registry.addAutocompleter('slashcommands', {
    trigger: '/',
    label: t('slash.label'),
    emptyText: t('slash.empty'),
    fetch: (query) =>
      rankSlashCommands(commands, query, t).map<AutocompleterItem>((cmd) => ({
        value: cmd.name,
        label: t(cmd.label),
        icon: cmd.icon,
        ...(cmd.shortcut ? { shortcut: cmd.shortcut } : {}),
      })),
    onSelect: (item, range, e) => {
      const cmd = commands.find((c) => c.name === item.value);
      if (!cmd) return;
      // Сначала убираем «/запрос», затем выполняем команду на очищенном месте.
      e.view.dispatch(e.view.state.tr.delete(range.from, range.to));
      cmd.run(e);
    },
  });
}
