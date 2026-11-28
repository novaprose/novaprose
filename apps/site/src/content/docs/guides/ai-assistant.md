---
title: AI assistant
description: Chat about the document, rewrite or fix text, edit the whole document and autocomplete as you type, with your own model — every change arrives as a suggested edit the author accepts or rejects.
---

With the `ai` plugin, the editor gets an AI assistant that works with the model of your choice
through your server. It appears in three places:

- **The assistant window** (`aidialog`) and **quick actions** (`aishortcuts`): select text and
  pick **Improve writing**, **Fix spelling and grammar**, **Make shorter**, **Summarize** and
  others, or type your own request.
- **The chat** (`aichat`), a panel next to the text. In **Ask** mode it answers questions about the
  document, and **Insert** or **Replace selection** puts an answer into the text. In **Edit** mode
  you say what to change ("fix the spelling", "make it formal"), and the model changes the whole
  document, or the selected paragraphs.
- **Autocomplete** (off by default): as the author types, the model suggests how the sentence goes
  on, in grey after the cursor; <kbd>Tab</kbd> accepts it.

Every change the model makes arrives as [suggested edits](/guides/suggested-edits/) from “AI”:
only the words the model changed are marked, and each change is accepted or rejected like a
colleague's.

The editor doesn't talk to a model itself and never holds an API key: it passes each request to a
function you provide, and that function goes through your server to the model of your choice.

## Setup

```ts
createEditor({
  element,
  plugins: ['suggestions', 'ai'],
  pluginOptions: {
    ai: {
      // Your call to your server. Yield the answer piece by piece to show it as it's written.
      async *request({ signal, ...body }) {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal, // aborted when the user closes the window, presses Stop or types on
        });
        if (!response.ok || !response.body) throw new Error(`AI request: ${response.status}`);
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          yield value;
        }
      },
    },
  },
});
```

If your server returns the whole answer at once, return it as a string instead:

```ts
ai: {
  request: async ({ signal, ...body }) => {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new Error(`AI request: ${response.status}`);
    return response.text();
  },
},
```

The **AI assistant** (`aidialog`) and **AI chat** (`aichat`) buttons are added to the toolbar.
`aidialog` and `aichat` are also menu items, `aishortcuts` is a menu button with the quick actions,
and `aiautocomplete` turns autocomplete on and off — add them where you like (see
[Toolbar and menus](/guides/toolbar-and-menus/)). If a request fails, the window or the chat says
so and the text doesn't change.

| Option         | Description                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request`      | `(request) => Promise<string> \| AsyncIterable<string>`: return the answer, or an async iterable of its pieces (shown as they come)                                                                                 |
| `name`         | name on the assistant's suggestions; `AI` in the editor's language by default                                                                                                                                       |
| `shortcuts`    | your own quick actions instead of the built-in ones: `[{ title, prompt, selection }]`, groups as `{ title, items: [...] }`; `selection: true` needs selected text, `false` works without it. `false` hides the menu |
| `autocomplete` | `true` or `{ delay }`: suggest how the text goes on after a pause in typing (700 ms by default). Off by default, because every pause is a request                                                                   |
| `maxDocument`  | the most document text sent with a chat message or an edit of the whole document, in characters; 50,000 by default                                                                                                  |

## The assistant window and quick actions

- With nothing selected, the assistant writes at the cursor: **Continue writing**, or your own
  request such as “write an introduction”.
- **Summarize** adds the summary as a new paragraph after the selected text.
- The answer appears in the window as the model writes it. Closing the window (<kbd>Esc</kbd>)
  cancels the request, and the text stays as it was.
- If the document changes while the model writes — a collaborator edits it — the answer still
  lands on the right text.

Your own quick actions replace the built-in list in the menu and in the window:

```ts
ai: {
  request,
  shortcuts: [
    { title: 'Write a tweet about it', prompt: 'Write a tweet about this text.', selection: true },
    {
      title: 'Translate',
      items: [
        { title: 'German', prompt: 'Translate into German.', selection: true },
        { title: 'Spanish', prompt: 'Translate into Spanish.', selection: true },
      ],
    },
  ],
},
```

With a selection, the answer to your quick action rewrites the selected text; without one, it is
written at the cursor.

## The chat

**AI chat** opens a panel next to the text (below it on a narrow screen). The message box has focus
right away: <kbd>Enter</kbd> sends, <kbd>Shift</kbd>+<kbd>Enter</kbd> starts a new line,
**Stop** cancels an answer, and **New chat** starts over. Examples in the empty panel send common
requests in one click.

- **Ask.** The model gets the document and the conversation so far, and the selected text when
  there is one; the line above the conversation says which. The answer stays in the panel until
  you use it: **Insert** puts it at the cursor (after a paragraph, as new paragraphs), **Replace
  selection** rewrites the selected text with it word by word, **Copy** copies it. Both are
  suggestions, like every other change.
- **Edit.** The model changes the document as you ask — the whole document, or the paragraphs the
  selection touches. Each paragraph it changed appears in the text as suggestions as soon as it
  arrives, so a long edit shows progress; the panel then says how many paragraphs changed and
  offers **Show in the text**, **Accept all** and **Reject all** for this edit. A paragraph someone
  changes while the model is writing is left as it is, and the panel says so. Code blocks are left
  out. When you ask for structure, it changes that too: a paragraph made a heading, paragraphs put
  in a bulleted or numbered list or a quote (neighbours form one list), new paragraphs and
  headings, paragraphs removed. Each of these is a suggestion as well, so rejecting gives the text
  back as it was.
- **Review.** The model reads the document (or the selected paragraphs) and lists its remarks,
  each with the reason: **Review the document** looks for mistakes, unclear sentences, repetitions
  and inconsistencies, and you can ask for something else (“check the tone of a business letter”).
  A remark with a fix arrives as a suggestion right where its words are, so each one is accepted or
  rejected on its own, from the panel or in the text; a remark without a fix (“this needs a
  source”) shows its place with **Show in the text**. Review works in a read-only document too: the
  remarks are listed, nothing changes.

While focus is in the panel, the selected text stays highlighted, so it is clear what “the
selection” is.

## Autocomplete

With `autocomplete: true`, a pause in typing at the end of a paragraph asks the model how the
sentence goes on. The suggestion appears in grey after the cursor and is not part of the document
until accepted: <kbd>Tab</kbd> or a tap on it accepts it, <kbd>Esc</kbd> dismisses it, and typing
the same letters keeps the rest of it. Screen readers announce the suggestion. The
**AI autocomplete** toggle (`aiautocomplete`) turns it off for the session.

Autocomplete sends a request on every pause, so give it a fast model (see the server example
below) and check your limits.

## Describing images

With the plugin on, the **Alternative text** dialog of an image (the image toolbar's
`imagealt`) gets a **Describe with AI** button. It sends the image and the text around it to your
model, which writes one or two sentences of alternative text, at most 150 characters, in the
language of the surrounding text. The answer goes into the field, not into the document: the author
reads it, changes what is wrong and saves. A purely decorative image gets an empty answer, and the
dialog says so.

The request has `action: 'describe'` and an `image`: its bytes as base64 (`data`, with its
`mimeType`) when the browser can read them — embedded images, uploads, and addresses on your site or
allowed by CORS — and its address (`src`) when it has one. Your server sends the image to a model
that reads images, as in the example below.

## What a request contains

| Field             | Description                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | a ready prompt with everything below and the rules for the answer: send it to the model as the user's message                                                                                                                                                                                     |
| `rules`           | the rules alone (the format of the answer, the language), for when you build your own prompt from the fields                                                                                                                                                                                      |
| `instruction`     | what to do: the user's own words, or, for a quick action, a ready instruction in English                                                                                                                                                                                                          |
| `action`          | a quick action (`improve`, `fix`, `shorter`, `longer`, `simplify`, `formal`, `friendly`, `summarize`, `continue`), `custom` (a request typed in the window), `chat`, `edit`, `review`, `complete` (autocomplete) or `describe` (alternative text for an image)                                    |
| `text`            | the selected text, paragraphs separated by a blank line; empty when nothing is selected. For `edit` and `review`, the paragraphs, each as `<block id="N">text</block>`; a heading, quote, list item or table cell says its kind, `<block id="N" type="h2">` (`quote`, `bullet`, `number`, `cell`) |
| `before`, `after` | up to 1,500 characters before and after the text or the cursor, for context                                                                                                                                                                                                                       |
| `document`        | for `chat`, the whole document as text (up to `maxDocument` characters)                                                                                                                                                                                                                           |
| `messages`        | for `chat`, the conversation so far: `[{ role: 'user' \| 'assistant', text }]`                                                                                                                                                                                                                    |
| `image`           | for `describe`, the image: `{ src?, data?, mimeType? }` — its address, and its bytes as base64 when the browser could read them                                                                                                                                                                   |
| `language`        | the editor's language, such as `en`                                                                                                                                                                                                                                                               |
| `signal`          | an `AbortSignal`, aborted when the user closes the window, presses **Stop** or types on                                                                                                                                                                                                           |

The answer is plain text, with paragraphs separated by a blank line. It goes into the document as
text, never as HTML, so a model can't add markup or scripts. For `edit`, the model answers with the
paragraphs it changed in the same `<block id="N">` form, or `NO CHANGES` — the rules in the prompt
ask for exactly that; for structure, `<block id="N" type="h2">` (a block of another kind: `p`,
`h1`–`h6`, `quote`, `bullet`, `number`), `<block after="N" type="p">` (a new block) and
`<block id="N" remove></block>`. For `review`, it answers with one line per remark,
`<finding block="N"><quote>words of that paragraph</quote><fix>what to put instead</fix><why>the reason</why></finding>`
(an empty `<fix>` for a remark without one), or `NO PROBLEMS`.

## On your server

The server checks the user, calls the model and streams the answer back as plain text. The editor
already wrote the prompt, so the server sends `prompt` as it is. Here is an example with Claude and
the Anthropic TypeScript SDK (`npm install @anthropic-ai/sdk`), written as a standard `Request` →
`Response` handler: a route handler in Next.js (`app/api/ai/route.ts`), or a handler in Hono, Bun
or Deno.

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the server's environment

const SYSTEM = `You are a writing assistant inside a document editor.
Follow the rules in the user's message about the form of your answer.`;

export async function POST(request: Request): Promise<Response> {
  // Check here that the user is signed in and within their limits: each request is billed.
  const { prompt, action, image } = await request.json();
  if (typeof prompt !== 'string' || typeof action !== 'string' || prompt.length > 200_000) {
    return new Response('Bad request', { status: 400 });
  }
  const complete = action === 'complete';
  // describe: the image goes to the model as an image, before the prompt.
  const picture = action === 'describe' ? imageBlock(image) : null;
  if (action === 'describe' && !picture) return new Response('Bad image', { status: 400 });
  const content = picture ? [picture, { type: 'text' as const, text: prompt }] : prompt;

  const stream = client.beta.messages.stream(
    complete
      ? {
          // Autocomplete runs on every pause in typing: the fast model, a few words, no thinking.
          model: 'claude-haiku-5-5',
          max_tokens: 100,
          thinking: { type: 'disabled' },
          system: SYSTEM,
          messages: [{ role: 'user', content }],
        }
      : {
          model: 'claude-opus-5-5',
          max_tokens: 16_000,
          output_config: { effort: action === 'chat' ? 'medium' : 'low' },
          // If the model declines, the API finishes the answer with a fallback model in the same stream.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SYSTEM,
          messages: [{ role: 'user', content }],
        },
  );

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        // A declined or cut-off answer is an error: the editor then changes nothing.
        // (A suggestion cut short is still a suggestion.)
        const { stop_reason } = await stream.finalMessage();
        const ok = stop_reason === 'end_turn' || (complete && stop_reason === 'max_tokens');
        if (!ok) throw new Error(`The model stopped: ${stop_reason}`);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      stream.abort(); // the user closed the window or pressed Stop: stop generating
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** The image of a describe request as an image block: its bytes, or else its https address. */
function imageBlock(image: unknown) {
  const { data, mimeType, src } = (image ?? {}) as Record<string, unknown>;
  const types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
  const type = types.find((t) => t === mimeType);
  if (
    typeof data === 'string' &&
    type &&
    data.length <= 7_000_000 &&
    /^[A-Za-z0-9+/=]+$/.test(data)
  )
    return { type: 'image' as const, source: { type: 'base64' as const, media_type: type, data } };
  if (typeof src === 'string' && src.startsWith('https://') && src.length <= 2000)
    return { type: 'image' as const, source: { type: 'url' as const, url: src } };
  return null;
}
```

With Express or Node's `http` module, write each piece with `res.write(event.delta.text)` and
finish with `res.end()`. The editor needs only the text of the answer, so any model can stand
behind `request` in the same way. To write your own prompt instead, build it from the fields and
add `rules`.

## Reviewing the changes

The assistant's changes are ordinary suggestions: put the cursor in one to accept or reject it, or
use **Review suggestions** to go through them and accept or reject all at once. They are saved with
the document and sync in [real-time collaboration](/guides/collaboration/) like any other
suggestion — see [Suggested edits](/guides/suggested-edits/).

The answer is compared with the original word by word, so only the words that changed become
suggestions. Words the model kept keep their formatting — bold, links, colors — and new words take
the formatting of the text they replace.

## What the assistant changes

The assistant edits text. When it rewrites a selection, the paragraphs of the answer replace the
selected paragraphs in order, so headings, lists and tables keep their structure: extra paragraphs
of the answer join the last one, and a paragraph the answer leaves out is suggested for deletion.
An edit from the chat changes paragraphs one by one and keeps their line breaks. The assistant
doesn't add formatting, links or images. At the end of a paragraph, new paragraphs of the answer
become new paragraphs; in the middle of a paragraph, the answer is inserted into it.

## Coming from TinyMCE

With `tinymce.init()`, `plugins: 'ai'` turns on the assistant (and the suggestions it needs), with
the `aidialog` and `aishortcuts` buttons and menu items:

- `ai_request(request, respondWith)` works as described in TinyMCE's documentation: `request` has
  `prompt`, `query`, `context`, `thread` and `system`, and the answer comes through
  `respondWith.string(signal => …)` or `respondWith.stream((signal, streamMessage) => …)`. The
  `prompt` is NovaProse's ready prompt, and `context` is plain text. An answer in HTML is turned
  into text.
- `ai_shortcuts` (with `subprompts` and `selection`; `false` or `[]` hides the menu).
- The `mceAiDialog` command (with `prompt`, `generate` and `display`) and `mceAiDialogClose`.
- The `AIRequest`, `AIResponse`, `AIError`, `AIDialogOpen` and `AIDialogClose` events.

The difference is in what happens to the answer: it arrives in the text as suggestions to accept or
reject, not as a preview in the window. The chat and autocomplete work with the same `ai_request`
(`query` is the message, `thread` the conversation). `getThreadLog()` isn't available.
