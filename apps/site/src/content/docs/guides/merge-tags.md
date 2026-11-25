---
title: Merge tags
description: Template variables like “Customer name” or “Order number” that your server fills in when it prints or sends the document.
---

The `mergetags` plugin adds template variables to the editor: receipts, contracts, email templates
and other documents where your server replaces “Customer name” or “Order number” with real values.
In the text a variable is one unit — it cannot be edited letter by letter, and
<kbd>Backspace</kbd> removes it whole.

```ts
createEditor({
  element,
  plugins: ['mergetags'],
  toolbar: 'undo redo | mergetags | bold italic',
  pluginOptions: {
    mergetags: {
      list: [
        {
          title: 'Customer',
          items: [
            { key: 'client', label: 'Customer name' },
            { key: 'phone', label: 'Phone' },
          ],
        },
        { key: 'orderId', label: 'Order number' },
      ],
    },
  },
});
```

People insert a variable from the `mergetags` toolbar button (grouped list) or by typing
<kbd>{{</kbd> and a few letters of its name.

## Saved HTML

```html
<p>Order № <span data-mergetag="orderId" contenteditable="false">Order number</span></p>
```

Your server finds every element with the attribute and replaces it with the value. If your
templates already use another attribute, set it — for example `attribute: 'data-var'`. Only
`data-*` names are accepted.

- The label shown in the editor always comes from `list`, so renaming a variable does not require
  touching saved templates.
- A key that is not in `list` is kept and highlighted with a dashed outline instead of being
  dropped, so old templates never lose data.
- The variable's own inline styles (a coloured chip from another editor) are ignored: they do not
  turn into bold or coloured text around it.
- Keys may contain letters, digits and `_ . : -`; anything else is rejected.
