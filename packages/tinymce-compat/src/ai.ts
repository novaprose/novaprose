import type { AiMessage, AiRequest } from '@novaprose/core';

/**
 * `ai_request` of TinyMCE's AI plugin on top of NovaProse's `pluginOptions.ai.request`. The request
 * and `respondWith` have the shape TinyMCE's public documentation describes: `query`, `context`,
 * `thread`, `system`, `prompt`, and `respondWith.string(signal => …)` or
 * `respondWith.stream((signal, streamMessage) => …)`. The answer still arrives as suggestions.
 */

/** A finished exchange of a conversation, as TinyMCE's thread log describes it. */
export interface TinyAiThreadEvent {
  eventUid: string;
  timestamp: string;
  request: Omit<TinyAiRequest, 'thread'>;
  response: { type: 'string'; data: string };
}

export interface TinyAiRequest {
  /** A ready prompt with the context and the rules: send it to the model as it is. */
  prompt: string;
  /** What the user asked, without the context. */
  query: string;
  /** The text to work on: the selection (the document, in the chat), as plain text. */
  context: string;
  /** Earlier exchanges of the chat. */
  thread: TinyAiThreadEvent[];
  /** How the model must answer for the editor to use the answer. */
  system: string[];
}

export interface TinyAiRespondWith {
  string(callback: (signal: AbortSignal) => Promise<string> | string): Promise<void>;
  stream(
    callback: (
      signal: AbortSignal,
      streamMessage: (message: string) => void,
    ) => Promise<void> | void,
  ): Promise<void>;
}

export type TinyAiHandler = (request: TinyAiRequest, respondWith: TinyAiRespondWith) => unknown;

type Fire = (name: string, event: Record<string, unknown>) => void;

function thread(messages: readonly AiMessage[]): TinyAiThreadEvent[] {
  const timestamp = new Date().toISOString();
  const events: TinyAiThreadEvent[] = [];
  messages.forEach((message, index) => {
    const answer = messages[index + 1];
    if (message.role !== 'user' || answer?.role !== 'assistant') return;
    events.push({
      eventUid: `nova-ai-${events.length + 1}`,
      timestamp,
      request: { prompt: message.text, query: message.text, context: '', system: [] },
      response: { type: 'string', data: answer.text },
    });
  });
  return events;
}

/** NovaProse's request → the one TinyMCE's `ai_request` gets. */
export function toTinyRequest(request: AiRequest): TinyAiRequest {
  const context =
    request.text ||
    (request.action === 'chat' ? request.document : '') ||
    (request.action === 'complete' ? request.before : '');
  return {
    prompt: request.prompt,
    query: request.instruction,
    context,
    thread: thread(request.messages ?? []),
    system: [...(request.rules ?? [])],
  };
}

const BLOCKS = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TR|UL|OL|TABLE|SECTION|ARTICLE|HEADER|FOOTER)$/;

/**
 * An HTML answer (integrations written for TinyMCE often ask the model for HTML) → plain text:
 * blocks become paragraphs, <br> a line break. Parsed into an inert document; only text is read.
 */
export function htmlToText(html: string): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const paragraphs: string[] = [];
  let line = '';
  const flush = () => {
    const text = line
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .trim();
    if (text) paragraphs.push(text);
    line = '';
  };
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) line += (child.textContent ?? '').replace(/\s+/g, ' ');
      else if (child.nodeName === 'BR') line += '\n';
      else if (child.nodeType === 1 && child.nodeName !== 'SCRIPT' && child.nodeName !== 'STYLE') {
        const block = BLOCKS.test(child.nodeName);
        if (block) flush();
        walk(child);
        if (block) flush();
      }
    }
  };
  walk(body);
  flush();
  return paragraphs.join('\n\n');
}

/**
 * Wraps `ai_request` as a `request` of the ai plugin. Fires AIRequest, AIResponse and AIError on the
 * TinyMCE-style editor, as TinyMCE does. A cancelled request (the window closed, Stop) ends quietly.
 */
export function tinyAiRequest(
  handler: TinyAiHandler,
  fire: Fire,
): (request: AiRequest) => AsyncIterable<string> {
  return (request) => {
    const tiny = toTinyRequest(request);
    const queue: string[] = [];
    let whole = '';
    let finished = false;
    let failure: unknown;
    let wake: (() => void) | null = null;
    const notify = () => {
      const resume = wake;
      wake = null;
      resume?.();
    };
    const push = (text: unknown) => {
      if (finished || text === null || text === undefined) return;
      const piece = String(text);
      whole += piece;
      queue.push(piece);
      notify();
    };
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      failure = error;
      notify();
    };
    const settle = (work: Promise<unknown>) => {
      work.then(
        () => finish(),
        (error: unknown) => finish(error ?? new Error('The AI request failed')),
      );
      return work.then(
        () => undefined,
        () => undefined,
      );
    };
    const respondWith: TinyAiRespondWith = {
      string: (callback) =>
        settle(Promise.resolve().then(async () => push(await callback(request.signal)))),
      stream: (callback) =>
        settle(Promise.resolve().then(() => callback(request.signal, (message) => push(message)))),
    };
    request.signal.addEventListener('abort', () => finish(), { once: true });
    fire('AIRequest', { request: tiny });
    try {
      handler(tiny, respondWith);
    } catch (error) {
      finish(error);
    }
    // Edits come back as <block> tags; any other answer that is HTML becomes text once it is complete.
    const html = request.action !== 'edit';
    return (async function* () {
      let buffered = false;
      for (;;) {
        while (queue.length) {
          const piece = queue.shift()!;
          if (html && !buffered && /^\s*</.test(whole)) buffered = true;
          if (!buffered) yield piece;
        }
        if (finished) break;
        await new Promise<void>((resolve) => (wake = resolve));
      }
      if (request.signal.aborted) return;
      if (failure !== undefined) {
        fire('AIError', { error: failure });
        throw failure instanceof Error ? failure : new Error(String(failure));
      }
      if (buffered) yield htmlToText(whole);
      fire('AIResponse', { response: whole });
    })();
  };
}
