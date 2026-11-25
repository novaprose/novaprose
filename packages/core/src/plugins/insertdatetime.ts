import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import type { MenuEntry } from '../ui/menu';

/**
 * Плагин insertdatetime: вставка текущей даты/времени в формате языка редактора.
 * Подключается лениво: `plugins: ['insertdatetime']` — код грузится отдельным чанком.
 */

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13v3l2 1"/></svg>';

const LABELS: Record<string, Record<'title' | 'date' | 'time' | 'dateTime' | 'long', string>> = {
  en: {
    title: 'Insert date/time',
    date: 'Date',
    time: 'Time',
    dateTime: 'Date and time',
    long: 'Long date',
  },
  ru: {
    title: 'Вставить дату/время',
    date: 'Дата',
    time: 'Время',
    dateTime: 'Дата и время',
    long: 'Дата прописью',
  },
};

const FORMATS: Record<'date' | 'time' | 'dateTime' | 'long', Intl.DateTimeFormatOptions> = {
  date: { dateStyle: 'short' },
  long: { dateStyle: 'long' },
  time: { timeStyle: 'short' },
  dateTime: { dateStyle: 'short', timeStyle: 'short' },
};

function insertText(editor: Editor, text: string): void {
  const { state, dispatch } = editor.view;
  dispatch(state.tr.insertText(text).scrollIntoView());
  editor.focus();
}

export default definePlugin({
  name: 'insertdatetime',
  toolbar: 'insertdatetime',
  setup(editor) {
    const lang = editor.options.language ?? 'en';
    const labels = LABELS[lang.split('-')[0]!] ?? LABELS.en!;
    // `now` — подменяемая точка для тестов.
    const now = () =>
      (editor.options.pluginOptions?.insertdatetime as { now?: () => Date } | undefined)?.now?.() ??
      new Date();
    const format = (kind: keyof typeof FORMATS) =>
      new Intl.DateTimeFormat(lang, FORMATS[kind]).format(now());

    // Пункт менюбара «Вставка → Дата/время» — дата и время по умолчанию.
    editor.ui.registry.addMenuItem('insertdatetime', {
      text: labels.title,
      icon: ICON,
      onAction: (e) => insertText(e, format('dateTime')),
    });

    editor.ui.registry.addMenuButton('insertdatetime', {
      icon: ICON,
      tooltip: labels.title,
      items: (e) =>
        (['date', 'long', 'time', 'dateTime'] as const).map<MenuEntry>((kind) => {
          const value = format(kind);
          return {
            id: kind,
            label: `${labels[kind]}: ${value}`,
            onSelect: () => insertText(e, value),
          };
        }),
    });
  },
});
