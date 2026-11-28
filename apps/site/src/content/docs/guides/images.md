---
title: Images
description: Upload pasted, dropped and picked images to your server; resize, align, caption, rotate, crop and brighten them.
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

## Rotating, cropping and colors

With the `editimage` plugin the image toolbar can also change the picture itself:

```ts
createEditor({ element, plugins: ['editimage'] });
```

- **Rotate left** and **Rotate right** (`rotateleft`, `rotateright`), **Flip vertically** and
  **Flip horizontally** (`flipv`, `fliph`) apply at once;
- **Edit image** (`editimage`) opens a dialog with a preview: crop it by dragging across the
  picture (drag the area to move it) or with the fields, free or to a shape (as the image, square,
  4:3, 3:2, 16:9); change its size in pixels; and its brightness, contrast and saturation.

The edited picture is a new file: it goes through `uploadImage` like any image, shown at once while
it uploads, and is embedded when there is no `uploadImage`. One undo brings the previous picture
back, and if the upload fails the original returns, with a notice. The file keeps its type for
PNG, JPEG and WebP; other types are saved as PNG (an animated GIF keeps its first frame).

To edit pixels the editor reads the file. An image from your own site always can be; one from
another site only if that site allows it (CORS), otherwise a notice says it can't be edited there.
For those, fetch the file through your server:

```ts
pluginOptions: {
  editimage: {
    // Your endpoint downloads the image and returns it (check the address on the server).
    fetchImage: async (src) => (await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`)).blob(),
    credentialsHosts: ['media.example.com'], // fetched with the reader's cookies
    quality: 0.9, // JPEG and WebP
  },
}
```

A proxy like this requests addresses chosen by whoever writes the document: give it the same care
as the server of the [link checker](/guides/link-checker/#a-server-that-checks-links-safely), with
your own network out of reach. SVG images are never edited: they can hold scripts.

Coming from TinyMCE: `plugins: 'image editimage'` works with `editimage_toolbar`,
`editimage_credentials_hosts`, `editimage_fetch_image` and the `mceImageRotateLeft`,
`mceImageRotateRight`, `mceImageFlipVertical`, `mceImageFlipHorizontal` and `mceEditImage`
commands. `editimage_cors_hosts`, `editimage_proxy` and `editimage_proxy_service_url` aren't
needed: images are read with CORS, and `editimage_fetch_image` (or `fetchImage`) is the way through
your server.

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
