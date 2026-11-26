import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import { insertText, openSymbolDialog, pickLabels, symbolPanel, type SymbolGroup } from './shared';

/**
 * The emoticons plugin: emoji with search + ":name" autocomplete right in the text (`:smile` → 😄).
 * `plugins: ['emoticons']`.
 */

const ICON = icons.emoji;

export const LABELS = {
  en: {
    title: 'Emoji',
    search: 'Search emoji',
    empty: 'No emoji found',
    groups: ['Smileys', 'Gestures', 'Hearts', 'Nature', 'Food', 'Activities', 'Objects', 'Symbols'],
  },
};

const EMOJI: (readonly (readonly [string, string])[])[] = [
  [
    ['😀', 'grinning'],
    ['😃', 'smiley'],
    ['😄', 'smile'],
    ['😁', 'grin'],
    ['😆', 'laughing'],
    ['😅', 'sweat smile'],
    ['😂', 'joy tears'],
    ['🙂', 'slight smile'],
    ['😉', 'wink'],
    ['😊', 'blush'],
    ['😇', 'innocent halo'],
    ['😍', 'heart eyes'],
    ['🤩', 'star struck'],
    ['😘', 'kiss'],
    ['😋', 'yum'],
    ['😎', 'sunglasses cool'],
    ['🤔', 'thinking'],
    ['😐', 'neutral'],
    ['😏', 'smirk'],
    ['😴', 'sleeping'],
    ['😮', 'open mouth surprised'],
    ['😢', 'cry sad'],
    ['😭', 'sob'],
    ['😡', 'angry rage'],
    ['🤯', 'mind blown'],
    ['🥳', 'party'],
    ['🤗', 'hug'],
    ['🙄', 'eye roll'],
    ['😬', 'grimace'],
    ['🤓', 'nerd'],
  ],
  [
    ['👍', 'thumbs up like yes'],
    ['👎', 'thumbs down dislike no'],
    ['👏', 'clap'],
    ['🙌', 'raised hands'],
    ['🙏', 'pray thanks please'],
    ['👋', 'wave hello'],
    ['✌️', 'victory peace'],
    ['🤝', 'handshake deal'],
    ['💪', 'muscle strong'],
    ['👌', 'ok'],
    ['🤞', 'fingers crossed'],
    ['👉', 'point right'],
    ['👀', 'eyes look'],
  ],
  [
    ['❤️', 'red heart love'],
    ['🧡', 'orange heart'],
    ['💛', 'yellow heart'],
    ['💚', 'green heart'],
    ['💙', 'blue heart'],
    ['💜', 'purple heart'],
    ['🖤', 'black heart'],
    ['💔', 'broken heart'],
    ['💯', 'hundred'],
    ['✨', 'sparkles'],
    ['🔥', 'fire hot'],
    ['⭐', 'star'],
  ],
  [
    ['☀️', 'sun'],
    ['🌙', 'moon'],
    ['⛅', 'cloud sun'],
    ['🌧️', 'rain'],
    ['❄️', 'snow'],
    ['🌈', 'rainbow'],
    ['🌸', 'blossom flower'],
    ['🌳', 'tree'],
    ['🍀', 'clover luck'],
    ['🐶', 'dog'],
    ['🐱', 'cat'],
    ['🦊', 'fox'],
    ['🐻', 'bear'],
    ['🐧', 'penguin'],
    ['🦋', 'butterfly'],
  ],
  [
    ['🍎', 'apple'],
    ['🍌', 'banana'],
    ['🍕', 'pizza'],
    ['🍔', 'burger'],
    ['🍰', 'cake'],
    ['🍪', 'cookie'],
    ['☕', 'coffee'],
    ['🍵', 'tea'],
    ['🍺', 'beer'],
    ['🍷', 'wine'],
    ['🎂', 'birthday cake'],
  ],
  [
    ['⚽', 'soccer football'],
    ['🏀', 'basketball'],
    ['🎾', 'tennis'],
    ['🎮', 'video game'],
    ['🎵', 'music note'],
    ['🎨', 'art palette'],
    ['🎉', 'tada celebration'],
    ['🎁', 'gift present'],
    ['🏆', 'trophy winner'],
    ['🚀', 'rocket launch'],
    ['✈️', 'airplane travel'],
  ],
  [
    ['💡', 'bulb idea'],
    ['📌', 'pin'],
    ['📎', 'paperclip attachment'],
    ['📅', 'calendar date'],
    ['📈', 'chart up growth'],
    ['📉', 'chart down'],
    ['📝', 'memo note'],
    ['📚', 'books'],
    ['💻', 'laptop computer'],
    ['📱', 'phone mobile'],
    ['🔒', 'lock secure'],
    ['🔑', 'key'],
    ['⏰', 'alarm clock'],
    ['📧', 'email mail'],
    ['💰', 'money bag'],
    ['🛠️', 'tools'],
  ],
  [
    ['✅', 'check done yes'],
    ['❌', 'cross no'],
    ['⚠️', 'warning'],
    ['❗', 'exclamation'],
    ['❓', 'question'],
    ['➕', 'plus'],
    ['➖', 'minus'],
    ['🔴', 'red circle'],
    ['🟢', 'green circle'],
    ['🔵', 'blue circle'],
    ['⬆️', 'up'],
    ['⬇️', 'down'],
    ['🆕', 'new'],
    ['🆗', 'ok button'],
  ],
];

export default definePlugin({
  name: 'emoticons',
  toolbar: 'emoticons',
  setup(editor) {
    const labels = pickLabels(editor, 'emoticons', LABELS);
    const groups: SymbolGroup[] = EMOJI.map((items, i) => ({ title: labels.groups[i]!, items }));
    const all = EMOJI.flat();
    const panel = (close: () => void) =>
      symbolPanel({
        groups,
        searchLabel: labels.search,
        emptyText: labels.empty,
        className: 'nova-emoticons',
        onPick: (emoji) => {
          close();
          insertText(editor, emoji);
        },
      });

    editor.ui.registry.addPanelButton('emoticons', {
      icon: ICON,
      tooltip: labels.title,
      isEnabled: (e) => e.isEditable(),
      render: (_e, close) => panel(close),
    });
    editor.ui.registry.addMenuItem('emoticons', {
      text: labels.title,
      icon: ICON,
      onAction: () => openSymbolDialog(editor, labels.title, panel),
    });

    // ":smi" → a list of matching emoji. At least two letters, so ":)" and the time "10:30" aren't disturbed.
    editor.ui.registry.addAutocompleter('emoticons', {
      trigger: ':',
      minChars: 2,
      label: labels.title,
      maxResults: 8,
      fetch: (query) => {
        const q = query.toLowerCase();
        if (!/^[a-z]+$/.test(q)) return [];
        return all
          .filter(([, name]) => name.split(' ').some((word) => word.startsWith(q)))
          .map(([emoji, name]) => ({ value: emoji, label: name, icon: emoji }));
      },
      onSelect: (item, range, e) => {
        const { state, dispatch } = e.view;
        dispatch(state.tr.insertText(item.value, range.from, range.to).scrollIntoView());
      },
    });
  },
});
