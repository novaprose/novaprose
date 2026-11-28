---
title: Locked content
description: Parts of a document that authors can't change — the frame of a template, legal terms, a variable — with fields inside them that stay editable.
---

Templates often have parts that must not change: the frame of a letter, a signature block, legal
terms, a placeholder for a value. With the `noneditable` plugin, an element with the class
`mceNonEditable` or the attribute `contenteditable="false"` is locked:

```ts
createEditor({
  element,
  plugins: ['noneditable'],
  content: `
    <p>Your text goes here.</p>
    <div class="mceNonEditable">
      <p>Terms and conditions apply to every order.</p>
    </div>
    <p>Dear <span class="mceNonEditable">{{customer}}</span>, thank you.</p>
  `,
});
```

A locked piece is one unit:

- a click, or an arrow key that reaches it, selects it whole; it can be copied, cut or deleted
  with Delete and Backspace;
- typing doesn't change it, and typing or pasting while it is selected doesn't replace it;
  Enter starts a new paragraph next to it;
- formatting a selection that crosses it formats what is around it, never what is inside;
- a double click selects a word in it for copying, without making it editable;
- screen readers hear that it is locked when it is selected.

Any element can be locked: a paragraph, a heading, a list, a table, a `div` or `section` around
several blocks, a `span` in a line of text. The HTML is written back as it came, with the same
class or attribute.

## Editable parts inside

A part of locked content marked with the class `mceEditable` (or `contenteditable="true"`) can be
edited, for example the fields of a form letter:

```html
<div class="mceNonEditable">
  <p>Dear customer,</p>
  <div class="mceEditable"><p>Write your message here.</p></div>
  <p>Kind regards, the team</p>
</div>

<p class="mceNonEditable">Order number: <span class="mceEditable">0000</span></p>
```

Changes stay inside the editable part: a selection that starts in it and ends in the locked text
around it can't be deleted. Outside locked content, `mceEditable` is an ordinary class, and
`contenteditable="true"` isn't kept at all: on a published page it would let readers edit the text.

## Your own class names

```ts
createEditor({
  element,
  plugins: ['noneditable'],
  pluginOptions: { noneditable: { noneditableClass: 'locked', editableClass: 'field' } },
});
```

## What locking protects

Locking is about the editor: it keeps authors from changing a piece by accident. It isn't access
control. The HTML still carries the locked text, and anyone who can send HTML to your server can
change it; check what matters on the server. In collaborative editing, changes from other people
are applied as they arrive (all of their editors lock the same pieces), and undo restores what was
there.

## Coming from TinyMCE

Content made with TinyMCE's `mceNonEditable` and `mceEditable` classes works as it is. With
`@novaprose/tinymce-compat`, locking is always on, as in TinyMCE, and the `noneditable_class` and
`editable_class` options name the classes. `noneditable_regexp` isn't supported yet.
