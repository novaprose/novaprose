import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import type { MenuEntry } from '../ui/menu';
import { insertText, pickLabels } from './shared';

/**
 * Плагин insertdatetime: вставка текущей даты/времени в формате языка редактора.
 * Подключается лениво: `plugins: ['insertdatetime']` — код грузится отдельным чанком.
 */

const ICON = icons.dateTime;

export const LABELS = {
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

export default definePlugin({
  name: 'insertdatetime',
  toolbar: 'insertdatetime',
  setup(editor) {
    const lang = editor.options.language ?? 'en';
    const labels = pickLabels(editor, 'insertdatetime', LABELS);
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
