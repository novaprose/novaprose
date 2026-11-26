import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import type { MenuEntry } from '../ui/menu';
import { insertText, pickLabels } from './shared';

/**
 * The insertdatetime plugin: inserts the current date/time in the format of the editor's language.
 * Attached lazily: `plugins: ['insertdatetime']`, the code loads as a separate chunk.
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
    // `now` is a replaceable point for tests.
    const now = () =>
      (editor.options.pluginOptions?.insertdatetime as { now?: () => Date } | undefined)?.now?.() ??
      new Date();
    const format = (kind: keyof typeof FORMATS) =>
      new Intl.DateTimeFormat(lang, FORMATS[kind]).format(now());

    // The menubar item "Insert → Date/time" inserts the default date and time.
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
