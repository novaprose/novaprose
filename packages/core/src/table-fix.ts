import type { Node as PMNode } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { fixTables } from 'prosemirror-tables';

/**
 * Broken tables repaired the way the editor repairs them: a table without cells goes, a row
 * missing cells gets empty ones, a cell spanning past the table is cut to fit. A separate chunk:
 * it loads with the first document that has a table (renderer.fromHTML on a server).
 */
export function repairTables(doc: PMNode): PMNode {
  const tr = fixTables(EditorState.create({ doc }));
  return tr ? tr.doc : doc;
}
