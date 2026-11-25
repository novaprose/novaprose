import type { Node as PMNode, NodeSpec } from 'prosemirror-model';
import { Plugin as PMPlugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import { pickLabels } from './shared';

/**
 * Плагин mergetags: переменные шаблона («Имя клиента», «Номер заказа»), которые ваш сервер
 * заменит значениями при печати или отправке. В тексте — нередактируемая «фишка», в HTML —
 * `<span data-mergetag="client">Имя клиента</span>` (имя атрибута настраивается).
 *
 * `plugins: ['mergetags']`, список — `pluginOptions.mergetags.list`. Вставка — кнопка `mergetags`
 * или ввод `{{` в тексте. Переменные, которых нет в списке, не теряются: показываются по ключу.
 */

export interface MergeTag {
  /** Ключ, который увидит ваш сервер: 'client', 'order.number'. */
  key: string;
  /** Подпись в редакторе: 'Имя клиента'. */
  label: string;
}

export interface MergeTagGroup {
  title: string;
  items: MergeTag[];
}

export interface MergeTagsOptions {
  /** Переменные — списком или по группам. */
  list?: (MergeTag | MergeTagGroup)[];
  /** Атрибут с ключом в HTML. По умолчанию 'data-mergetag'. */
  attribute?: string;
}

const LABELS = {
  en: {
    insert: 'Insert variable',
    search: 'Variables',
    empty: 'No variables found',
    unknown: 'Unknown variable',
  },
  ru: {
    insert: 'Вставить переменную',
    search: 'Переменные',
    empty: 'Переменные не найдены',
    unknown: 'Неизвестная переменная',
  },
};

/** Ключ без пробелов и кавычек — он уходит в атрибут и на ваш сервер. */
const KEY_RE = /^[\w.:-]{1,100}$/;
/** Атрибут: только data-* (не даём назвать его onclick или href). */
const ATTR_RE = /^data-[a-z0-9-]{1,40}$/;

function optionsOf(editor: Editor): MergeTagsOptions {
  return (editor.options.pluginOptions?.mergetags as MergeTagsOptions | undefined) ?? {};
}

function attributeOf(editor: Editor): string {
  const attribute = optionsOf(editor).attribute ?? 'data-mergetag';
  if (ATTR_RE.test(attribute)) return attribute;
  console.warn(
    `[nova] mergetags: attribute "${attribute}" must look like data-name; using data-mergetag`,
  );
  return 'data-mergetag';
}

const isGroup = (entry: MergeTag | MergeTagGroup): entry is MergeTagGroup =>
  Array.isArray((entry as MergeTagGroup).items);

function flatList(editor: Editor): MergeTag[] {
  return (optionsOf(editor).list ?? []).flatMap((entry) =>
    isGroup(entry) ? entry.items : [entry],
  );
}

function labelFor(editor: Editor, key: string): string | undefined {
  return flatList(editor).find((tag) => tag.key === key)?.label;
}

function buildNodes(editor: Editor): Record<string, NodeSpec> {
  const attribute = attributeOf(editor);
  return {
    mergetag: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: true,
      draggable: true,
      // Свой style «фишки» (цвет, фон, жирность) — оформление, а не формат текста вокруг.
      ignoreStyles: true,
      attrs: { key: {}, label: { default: '' } },
      parseDOM: [
        {
          tag: `span[${attribute}]`,
          // Выше марок и стилей: переменная — целый узел, а не span с форматированием.
          priority: 60,
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const key = el.getAttribute(attribute) ?? '';
            if (!KEY_RE.test(key)) return false;
            return { key, label: labelFor(editor, key) ?? el.textContent?.trim() ?? key };
          },
        },
      ],
      // Документ мог прийти из JSON — ключ проверяем и на выходе.
      toDOM: (node) => {
        const key = KEY_RE.test(node.attrs.key as string) ? (node.attrs.key as string) : '';
        const label = (node.attrs.label as string) || key;
        return ['span', { [attribute]: key, contenteditable: 'false' }, label];
      },
    },
  };
}

/** Отображение в редакторе: «фишка» с подписью из списка (подпись в HTML могла устареть). */
class MergeTagView {
  readonly dom: HTMLElement;

  constructor(
    private node: PMNode,
    private readonly editor: Editor,
    private readonly unknownTitle: string,
  ) {
    this.dom = document.createElement('span');
    this.dom.className = 'nova-mergetag';
    this.dom.contentEditable = 'false';
    this.render();
  }

  private render(): void {
    const key = this.node.attrs.key as string;
    const known = labelFor(this.editor, key);
    this.dom.textContent = known ?? ((this.node.attrs.label as string) || key);
    this.dom.dataset.key = key;
    const list = optionsOf(this.editor).list;
    // Ключа нет в списке — подсвечиваем, но не удаляем: шаблон не теряет данных.
    const unknown = !!list?.length && known === undefined;
    this.dom.classList.toggle('is-unknown', unknown);
    this.dom.title = unknown ? `${this.unknownTitle}: ${key}` : key;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('is-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected');
  }

  stopEvent(): boolean {
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }
}

function insertTag(editor: Editor, tag: MergeTag, range?: { from: number; to: number }): void {
  const { state, dispatch } = editor.view;
  const node = editor.schema.nodes.mergetag!.create({ key: tag.key, label: tag.label });
  const tr = range
    ? state.tr.replaceWith(range.from, range.to, node)
    : state.tr.replaceSelectionWith(node, false);
  dispatch(tr.scrollIntoView());
  editor.focus();
}

export default definePlugin({
  name: 'mergetags',
  toolbar: 'mergetags',
  nodes: buildNodes,
  prosemirrorPlugins: (editor) => {
    const labels = pickLabels(editor, LABELS);
    return [
      new PMPlugin({
        props: {
          nodeViews: {
            mergetag: (node: PMNode, _view: EditorView) =>
              new MergeTagView(node, editor, labels.unknown),
          },
        },
      }),
    ];
  },
  setup(editor) {
    const labels = pickLabels(editor, LABELS);

    editor.ui.registry.addMenuButton('mergetags', {
      icon: icons.mergeTags,
      tooltip: labels.insert,
      isEnabled: (e) => e.isEditable() && flatList(e).length > 0,
      items: (e) => {
        const entries: MenuEntry[] = [];
        const item = (tag: MergeTag, id: string): MenuEntry => ({
          id,
          label: tag.label,
          onSelect: () => insertTag(e, tag),
        });
        (optionsOf(e).list ?? []).forEach((entry, index) => {
          if (isGroup(entry)) {
            if (entries.length) entries.push({ type: 'separator' });
            entries.push({ type: 'heading', label: entry.title });
            entry.items.forEach((tag, i) => entries.push(item(tag, `mergetag-${index}-${i}`)));
          } else {
            entries.push(item(entry, `mergetag-${index}`));
          }
        });
        return entries;
      },
    });

    // {{ в тексте — список с поиском по подписи и ключу.
    editor.ui.registry.addAutocompleter('mergetags', {
      trigger: '{{',
      label: labels.search,
      emptyText: labels.empty,
      maxResults: 12,
      fetch: (query, e) => {
        const q = query.toLowerCase();
        return flatList(e)
          .filter((tag) => tag.label.toLowerCase().includes(q) || tag.key.toLowerCase().includes(q))
          .map((tag) => ({ value: tag.key, label: tag.label, detail: tag.key }));
      },
      onSelect: (item, range, e) => {
        const tag = flatList(e).find((t) => t.key === item.value);
        if (tag) insertTag(e, tag, range);
      },
    });
  },
});
