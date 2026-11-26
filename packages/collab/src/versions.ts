import type { RevisionHistoryOptions } from '@novaprose/core';
import { yXmlFragmentToProseMirrorRootNode } from 'y-prosemirror';
import * as Y from 'yjs';

/** A request to the sync server over the open connection (stateless messages). */
export type ServerRequest = (message: Record<string, unknown>) => Promise<Record<string, unknown>>;

export type VersionSource = Pick<RevisionHistoryOptions, 'list' | 'load' | 'save'>;

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const fail = (reply: Record<string, unknown>) =>
  new Error(`[nova] versions: ${String(reply.error ?? 'unexpected reply')}`);

/**
 * Version history from the NovaProse sync server, for `pluginOptions.revisionhistory`. The server
 * keeps Yjs snapshots; here they become documents through the current editor's schema.
 */
export function serverVersions(request: ServerRequest, field: string): VersionSource {
  return {
    async list() {
      const reply = await request({ nova: 'versions' });
      if (reply.nova !== 'versions' || !Array.isArray(reply.versions)) throw fail(reply);
      return (reply.versions as Record<string, unknown>[]).map((v) => ({
        id: String(v.id),
        createdAt: Number(v.createdAt) || 0,
        authors: Array.isArray(v.authors) ? v.authors.map(String) : [],
        label: typeof v.label === 'string' ? v.label : null,
      }));
    },
    async load(revision, editor) {
      const reply = await request({ nova: 'version', id: Number(revision.id) });
      if (reply.nova !== 'version' || typeof reply.state !== 'string') throw fail(reply);
      const doc = new Y.Doc();
      try {
        Y.applyUpdate(doc, fromBase64(reply.state));
        return yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(field), editor.schema).toJSON();
      } finally {
        doc.destroy();
      }
    },
    async save(label) {
      const reply = await request({ nova: 'save-version', ...(label ? { label } : {}) });
      if (reply.nova !== 'saved') throw fail(reply);
    },
  };
}
