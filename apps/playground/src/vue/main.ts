import '@novaprose/core/style.css';
import '../playground.css';
import {
  NodeViewContent,
  NovaProseEditor,
  nodeViewProps,
  vueNodeView,
  useCommand,
  useEditor,
  useEditorState,
  type CommandName,
  type Editor,
} from '@novaprose/vue';
import { createApp, defineComponent, h, inject, provide, ref, type PropType } from 'vue';
import { CALLOUT_CONTENT, calloutPlugin, TONES } from '../callout';

/**
 * The Vue playground: the component with v-model in a form and a headless editor with its own toolbar on composables.
 * No SFC compiler: render functions. e2e drives it too (e2e/vue.spec.ts).
 */

const INITIAL = '<p>Hello from <strong>Vue</strong>!</p>';

const FormDemo = defineComponent(() => {
  const value = ref(INITIAL);
  const submitted = ref<string | null>(null);
  const changes = ref(0);
  return () =>
    h('section', { class: 'pg-react-block', 'aria-labelledby': 'form-title' }, [
      h('h2', { id: 'form-title' }, 'The component with v-model in a form'),
      h(
        'form',
        {
          'data-testid': 'form',
          onSubmit: (event: SubmitEvent) => {
            event.preventDefault();
            submitted.value = String(
              new FormData(event.currentTarget as HTMLFormElement).get('body'),
            );
          },
        },
        [
          h(NovaProseEditor, {
            name: 'body',
            modelValue: value.value,
            'onUpdate:modelValue': (html: string) => {
              value.value = html;
              changes.value++;
            },
            init: { toolbar: 'undo redo | bold italic | bullist numlist', statusbar: false },
          }),
          h('div', { class: 'pg-react-actions' }, [
            h('button', { type: 'submit' }, 'Submit'),
            h('button', { type: 'button', onClick: () => (value.value = INITIAL) }, 'Reset'),
          ]),
        ],
      ),
      h('p', ['update:modelValue: ', h('output', { 'data-testid': 'changes' }, changes.value)]),
      h('pre', { 'data-testid': 'value' }, value.value),
      submitted.value !== null ? h('pre', { 'data-testid': 'submitted' }, submitted.value) : null,
    ]);
});

const BUTTONS: Array<[CommandName, string]> = [
  ['bold', 'B'],
  ['italic', 'I'],
  ['h2', 'H2'],
  ['bulletList', '• List'],
];

const CommandButton = defineComponent({
  props: {
    editor: { type: Object as PropType<Editor | null>, default: null },
    command: { type: String as PropType<CommandName>, required: true },
    label: { type: String, required: true },
  },
  setup(props) {
    const { active, enabled, run } = useCommand(() => props.editor, props.command);
    return () =>
      h(
        'button',
        {
          type: 'button',
          'data-command': props.command,
          'aria-pressed': String(active.value),
          disabled: !enabled.value && !active.value,
          // mousedown doesn't take focus from the editor: the selection is kept.
          onMousedown: (event: MouseEvent) => event.preventDefault(),
          onClick: () => run(),
        },
        props.label,
      );
  },
});

const HeadlessDemo = defineComponent(() => {
  const { el, editor } = useEditor({
    content: '<p>A custom toolbar on the useEditor and useCommand composables.</p>',
    toolbar: false,
    statusbar: false,
  });
  const stats = useEditorState(editor, (e) => ({
    words: e.getText().trim().split(/\s+/).filter(Boolean).length,
    canUndo: e.can('undo'),
  }));
  return () =>
    h('section', { class: 'pg-react-block', 'aria-labelledby': 'headless-title' }, [
      h('h2', { id: 'headless-title' }, 'Headless: a custom toolbar'),
      h('div', { role: 'toolbar', 'aria-label': 'Custom toolbar', class: 'pg-react-toolbar' }, [
        ...BUTTONS.map(([command, label]) =>
          h(CommandButton, { key: command, editor: editor.value, command, label }),
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: !stats.value?.canUndo,
            onClick: () => editor.value?.exec('undo'),
          },
          'Undo',
        ),
      ]),
      h('div', { ref: el, 'data-testid': 'headless' }),
      h('p', ['Words: ', h('output', { 'data-testid': 'words' }, stats.value?.words ?? 0)]),
    ]);
});

const THEME = Symbol('theme');

/** A node view in Vue: its own fields (they don't reach the document text) and the content in its place. */
const Callout = defineComponent({
  props: nodeViewProps,
  setup(props) {
    const theme = inject(THEME, 'light');
    return () =>
      h('div', { class: 'pg-callout', 'data-tone': String(props.node.attrs.tone) }, [
        h('div', { class: 'pg-callout-bar', contenteditable: 'false' }, [
          h(
            'select',
            {
              'aria-label': 'Callout tone',
              value: String(props.node.attrs.tone),
              onChange: (event: Event) =>
                props.updateAttributes({ tone: (event.target as HTMLSelectElement).value }),
            },
            TONES.map(([value, label]) => h('option', { value }, label)),
          ),
          h('input', {
            'aria-label': 'Callout title',
            placeholder: 'Title',
            value: String(props.node.attrs.title),
            onInput: (event: Event) =>
              props.updateAttributes({ title: (event.target as HTMLInputElement).value }),
          }),
          h('span', { 'data-testid': 'nv-theme' }, theme),
        ]),
        h(NodeViewContent, { class: 'pg-callout-body' }),
      ]);
  },
});

const callout = calloutPlugin(vueNodeView(Callout));

const NodeViewsDemo = defineComponent(() => {
  provide(THEME, 'dark');
  const html = ref(CALLOUT_CONTENT);
  return () =>
    h('section', { class: 'pg-react-block', 'aria-labelledby': 'nv-title' }, [
      h('h2', { id: 'nv-title' }, 'A node view as a Vue component'),
      h(NovaProseEditor, {
        plugins: [callout],
        defaultValue: CALLOUT_CONTENT,
        'onUpdate:modelValue': (value: string) => (html.value = value),
        init: { toolbar: 'undo redo | bold italic', statusbar: false },
        class: 'pg-node-views',
      }),
      h('pre', { 'data-testid': 'nv-html' }, html.value),
    ]);
});

createApp(() =>
  h('main', { class: 'pg-react' }, [
    h('h1', ['NovaProse ', h('span', { class: 'pg-badge' }, 'Vue')]),
    h(FormDemo),
    h(HeadlessDemo),
    h(NodeViewsDemo),
  ]),
).mount('#app');
