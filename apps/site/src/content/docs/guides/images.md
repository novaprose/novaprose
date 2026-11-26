---
title: Images
description: Upload pasted, dropped and picked images to your server, then resize and align them.
---

Without configuration, images are embedded as `data:` URLs. That is fine for demos but bloats
your HTML. Give the editor an upload function instead:

```ts
createEditor({
  element,
  uploadImage: async (file, progress) => {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/uploads', { method: 'POST', body });
    if (!response.ok) throw new Error('Upload failed');
    const { url } = await response.json();
    return url; // the editor inserts <img src="…">
  },
});
```

`uploadImage` handles images that are **pasted**, **dropped** onto the editor or **picked** in the
image dialog. The image appears immediately as a local preview while the file uploads, and a
notification shows the progress you report with `progress(percent)`. When the promise resolves,
the preview is replaced with your URL (without an extra undo step).

If it rejects, the editor retries twice on its own (after 1 and 3 seconds) — most network errors
are temporary. If the upload still fails, the image stays where it was and the notification offers
**Retry** and **Remove image**; dismissing the notification removes the image, so a local preview
address never ends up in the saved document.

The returned URL must pass the image allowlist: `https:`, `http:` and relative URLs, plus
base64 `data:` URLs of raster formats (PNG, JPEG, GIF, WebP, AVIF, BMP). Anything else, including
`data:image/svg+xml`, is refused.

## Editing images

Select an image to open its context toolbar: alignment (`imagealignleft`, `imagealigncenter`,
`imagealignright`), size presets (`imagesize`), alternative text (`imagealt`) and delete. Drag the
corner handle to resize. Width and height are stored as attributes, so the output stays plain
HTML.

## Captions

The **Caption** button (`imagecaption`) in the image toolbar turns the image into a figure with an
editable caption, and puts the cursor into it:

```html
<figure style="width: 320px;">
  <img src="…" alt="…" width="320" />
  <figcaption>Sunset, <em>July</em></figcaption>
</figure>
```

- The caption is regular text: bold, italic and links work. **Enter** moves on to a new paragraph
  below the image.
- Alignment, size and alternative text work the same way for captioned images.
- The figure gets the image width, so the caption wraps to the image even outside the editor
  (e-mail, print).
- Pressing **Caption** again removes it; the caption text is kept as a paragraph below the image.
- With `validElements` that exclude `figure`, captioned images are loaded as an image followed
  by a paragraph — nothing is lost.

## On your server

- Check the file type and size on the server; never trust what the browser sends.
- Serve uploads from a separate domain, or with a strict `Content-Type` and
  `Content-Disposition`, so that an uploaded SVG or HTML file cannot run scripts on your site.
