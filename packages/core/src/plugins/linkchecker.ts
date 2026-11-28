import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { addLinkNote } from '../ui/link-bubble';
import css from './linkchecker.css?raw';
import { pickLabels } from './shared';

/**
 * The linkchecker plugin: links are checked as the document changes, and a broken one gets a wavy
 * red underline (aria-invalid for screen readers). The link's bubble says "This link seems broken",
 * next to the address, with Ignore; editing or removing it are the bubble's usual buttons.
 *
 * The check is your service, like the spell check: a browser can't see whether another site's page
 * answers (it doesn't let a page read other sites' answers), so `pluginOptions.linkchecker.check`
 * asks your server, or `serviceUrl` points to a server that answers POST `{ urls }` with
 * `{ results: { [url]: 'valid' | 'invalid' | 'unknown' } }`. Only absolute http(s) addresses are
 * checked, each once in a while (answers are kept for ten minutes), at most fifty in one request.
 */

export const LABELS = {
  en: {
    toggle: 'Check links',
    broken: 'This link seems broken',
    ignore: 'Ignore',
    failed: 'The link check service is not available.',
  },
};

export type LinkStatus = 'valid' | 'invalid' | 'unknown';

export interface LinkCheckerOptions {
  /** Your service, through your server: the status of each address. */
  check?: (urls: string[], signal: AbortSignal) => Promise<Record<string, LinkStatus>>;
  /** When `check` isn't given: a server that answers POST { urls } with { results: { [url]: status } }. */
  serviceUrl?: string;
  /** Changes an address before it is checked (leave out a token in it); the link stays as it is. */
  preprocess?: (url: string) => string;
  /** Start with checking on (yes, when there is a service). */
  active?: boolean;
  /** How long after a change the links are checked, in milliseconds (1000). */
  delay?: number;
}

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/><path d="m15 19 2 2 4-4"/></svg>';

/** Addresses asked about in one request, kept for how long, and at most in one document. */
const BATCH = 50;
const KEEP = 10 * 60 * 1000;
const MAX = 500;

const linkKey = new PluginKey<DecorationSet>('nova-linkchecker');
const checkers = new WeakMap<Editor, ReturnType<typeof createChecker>>();

/** Addresses worth asking about: absolute http(s), not too long. */
export function checkable(href: unknown): href is string {
  return typeof href === 'string' && href.length <= 2000 && /^https?:\/\/[^\s/?#]+/i.test(href);
}

/** The links of a document and where they are (a link split by formatting is one). */
function linksIn(state: EditorState): { href: string; from: number; to: number }[] {
  const type = state.schema.marks.link;
  const out: { href: string; from: number; to: number }[] = [];
  if (!type) return out;
  state.doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    const href = node.marks.find((m) => m.type === type)?.attrs.href;
    if (checkable(href)) {
      const last = out[out.length - 1];
      if (last && last.href === href && last.to === pos) last.to = pos + node.nodeSize;
      else out.push({ href, from: pos, to: pos + node.nodeSize });
    }
    return false;
  });
  return out;
}

/** A server that answers POST { urls } with { results } as a `check` function. */
function service(url: string) {
  return async (urls: string[], signal: AbortSignal): Promise<Record<string, LinkStatus>> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok) throw new Error(`The link check service answered ${response.status}`);
    const data = (await response.json()) as { results?: Record<string, LinkStatus> } | null;
    return data?.results ?? (data as Record<string, LinkStatus>);
  };
}

export default definePlugin({
  name: 'linkchecker',
  toolbar: 'linkchecker',
  prosemirrorPlugins: (editor) => {
    const checker = checkers.get(editor) ?? createChecker(editor);
    checkers.set(editor, checker);
    return [
      new Plugin<DecorationSet>({
        key: linkKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const fresh = tr.getMeta(linkKey) as DecorationSet | undefined;
            if (fresh) return fresh;
            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
          },
        },
        props: { decorations: (state) => linkKey.getState(state) },
        view: (view) => {
          // Views made again (a host application making the state anew): mark what is known.
          if (checker.started) checker.schedule(0);
          return {
            update(_view, previous) {
              if (view.state.doc !== previous.doc) checker.schedule();
            },
            // Work in progress stops with the view; the editor's destroy stops the checker.
            destroy: () => checker.stop(),
          };
        },
      }),
    ];
  },
  setup(editor) {
    const checker = checkers.get(editor)!;
    const { labels } = checker;
    editor.ui.addStyles('nova-linkchecker', css);
    editor.ui.registry.addToggleButton('linkchecker', {
      icon: ICON,
      tooltip: labels.toggle,
      isActive: () => checker.active,
      onAction: () => checker.setActive(!checker.active),
    });
    editor.ui.registry.addMenuItem('linkchecker', {
      text: labels.toggle,
      icon: ICON,
      isActive: () => checker.active,
      onAction: () => checker.setActive(!checker.active),
    });
    const offNote = addLinkNote(editor, (href) =>
      checker.isBroken(href)
        ? { text: labels.broken, action: { label: labels.ignore, run: () => checker.ignore(href) } }
        : null,
    );
    checker.start();
    return () => {
      offNote();
      checker.destroy();
    };
  },
});

function createChecker(editor: Editor) {
  const options = (editor.options.pluginOptions?.linkchecker ?? {}) as LinkCheckerOptions;
  const labels = pickLabels(editor, 'linkchecker', LABELS);
  const check =
    typeof options.check === 'function'
      ? options.check
      : typeof options.serviceUrl === 'string' && options.serviceUrl
        ? service(options.serviceUrl)
        : null;
  // What the service said, by address, and when.
  const answers = new Map<string, { status: LinkStatus; at: number }>();
  const asking = new Set<string>();
  const ignored = new Set<string>();
  // Aborts the requests in progress (made anew after each stop); `destroyed` is for good.
  let controller = new AbortController();
  let destroyed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let again = false;
  let warned = false;

  const known = (href: string): LinkStatus | null => {
    const answer = answers.get(href);
    return answer && Date.now() - answer.at < KEEP ? answer.status : null;
  };
  const prepare = (href: string): string => {
    try {
      const out = options.preprocess?.(href);
      return typeof out === 'string' && out ? out : href;
    } catch {
      return href;
    }
  };

  const checker = {
    labels,
    active: options.active !== false && !!check,
    started: false,

    start() {
      checker.started = true;
      if (checker.active) checker.schedule(0);
    },

    schedule(delay = Math.max(0, Number(options.delay ?? 1000)) || 0) {
      if (!checker.active || destroyed) return;
      clearTimeout(timer);
      timer = setTimeout(() => void checker.run(), delay);
    },

    /** Asks about the addresses not known yet, in batches; marks the broken ones as answers come. */
    async run() {
      if (running) {
        again = true;
        return;
      }
      if (!check || !checker.active || destroyed) return;
      running = true;
      const { signal } = controller;
      try {
        const now = Date.now();
        for (const [href, answer] of answers) if (now - answer.at >= KEEP) answers.delete(href);
        const todo = [...new Set(linksIn(editor.view.state).map((link) => link.href))]
          .filter((href) => !known(href) && !asking.has(href) && !ignored.has(href))
          .slice(0, MAX);
        while (todo.length && !signal.aborted && checker.active) {
          const batch = todo.splice(0, BATCH);
          batch.forEach((href) => asking.add(href));
          // The address asked about (after preprocess) → the links' own (one or more).
          const asked = new Map<string, string[]>();
          for (const href of batch) {
            const prepared = prepare(href);
            asked.set(prepared, [...(asked.get(prepared) ?? []), href]);
          }
          let answer: unknown;
          try {
            answer = await check([...asked.keys()], signal);
          } catch (error) {
            batch.forEach((href) => asking.delete(href));
            if (signal.aborted) return;
            if (!warned) {
              warned = true;
              console.warn('[nova] linkchecker:', error);
              editor.ui.notify({ text: labels.failed, type: 'warning' });
            }
            return;
          }
          batch.forEach((href) => asking.delete(href));
          if (signal.aborted) return;
          const results = (answer && typeof answer === 'object' ? answer : {}) as Record<
            string,
            unknown
          >;
          const at = Date.now();
          for (const [prepared, hrefs] of asked) {
            const status = results[prepared];
            for (const href of hrefs) {
              answers.set(href, {
                status: status === 'valid' || status === 'invalid' ? status : 'unknown',
                at,
              });
            }
          }
          checker.paint();
        }
        // Links whose answer is already known (a second copy, one brought back by undo).
        if (!signal.aborted) checker.paint();
      } finally {
        running = false;
        if (again) {
          again = false;
          checker.schedule(0);
        }
      }
    },

    isBroken(href: string): boolean {
      return checker.active && !ignored.has(href) && known(href) === 'invalid';
    },

    /** Underlines the broken links (none while checking is off); nothing happens when they already are. */
    paint() {
      if (destroyed) return;
      const { state } = editor.view;
      const wanted = checker.active
        ? linksIn(state).filter((link) => checker.isBroken(link.href))
        : [];
      const ranges = (list: { from: number; to: number }[]) =>
        list
          .map((range) => `${range.from}:${range.to}`)
          .sort()
          .join();
      if (ranges(wanted) === ranges(linkKey.getState(state)?.find() ?? [])) return;
      const decorations = wanted.map((link) =>
        Decoration.inline(link.from, link.to, {
          class: 'nova-link-broken',
          title: labels.broken,
          'aria-invalid': 'true',
        }),
      );
      editor.view.dispatch(
        state.tr
          .setMeta(linkKey, DecorationSet.create(state.doc, decorations))
          .setMeta('addToHistory', false),
      );
    },

    /** This address isn't marked again in this editor. */
    ignore(href: string) {
      ignored.add(href);
      checker.paint();
      editor.focus();
    },

    setActive(value: boolean) {
      if (!check) {
        editor.ui.notify({ text: labels.failed, type: 'warning' });
        return;
      }
      checker.active = value;
      checker.paint();
      if (value) checker.schedule(0);
      editor.updateUI();
    },

    /** Stops what is in progress: the next change starts again. */
    stop() {
      clearTimeout(timer);
      controller.abort();
      controller = new AbortController();
    },

    destroy() {
      destroyed = true;
      checker.stop();
    },
  };
  return checker;
}
