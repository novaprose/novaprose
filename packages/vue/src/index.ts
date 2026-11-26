export { NovaProseEditor, type NovaProseInit } from './NovaProseEditor';
export {
  useEditor,
  useEditorState,
  useCommand,
  shallowEqual,
  type UseEditorOptions,
  type UseEditorResult,
  type UseCommandResult,
} from './composables';
export { vueNodeView, nodeViewProps, NodeViewContent, useNodeView } from './nodeViews';
export type {
  Editor,
  EditorOptions,
  EditorEvent,
  CommandName,
  ToolbarConfig,
  NodeViewProps,
  NodeViewOptions,
} from '@novaprose/core';
