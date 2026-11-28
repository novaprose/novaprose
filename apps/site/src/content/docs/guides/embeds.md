---
title: Video and web pages
description: YouTube, Vimeo and video files with the media plugin, and any web page in a sandboxed frame with pageembed.
---

Two plugins put something from another site into a document: `media` for video, and `pageembed`
for a web page (a map, a form, a calendar, a dashboard). Both show it in the editor as it will look,
under a layer: a click selects the block, so it can be moved, deleted or edited, and the page in
it doesn't take the click.

```ts
createEditor({ element, plugins: ['media', 'pageembed'] });
```

The **Video** and **Embedded page** buttons are added to the toolbar, and both are in the
**Insert** menu.

## Video

**Video** takes a YouTube or Vimeo link, as copied from the address bar, or the address of an
`.mp4`, `.webm` or `.ogg` file over https. YouTube plays from `youtube-nocookie.com`, which sets no
cookies until the video is played. Any other address is refused: the plugin embeds only these
players, and an `<iframe>` from anywhere else, pasted or in HTML you load, is dropped.

```html
<iframe
  src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  width="560"
  height="315"
  title="Launch"
  allow="…"
  allowfullscreen=""
  loading="lazy"
  …
></iframe>
```

## Embedded page

**Embedded page** asks for the page's address and a title for screen readers (the site's name
when you leave it empty), and how big it is:

- **Full width** with a ratio (21:9, 16:9, 4:3, 1:1): the page fills the width of the text and
  keeps its shape on any screen;
- **Fixed size**: a width and a height in pixels.

and whether to show a border and scroll bars. A page embedded at full width comes out like this:

```html
<div
  class="nova-pageembed nova-pageembed--16by9"
  style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden"
>
  <iframe
    src="https://maps.example.com/embed?q=office"
    title="Office map"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
    allow="fullscreen"
    allowfullscreen=""
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
    frameborder="0"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0"
  ></iframe>
</div>
```

The sizes are inline styles too, so the page that shows the HTML needs no CSS for them. In Word,
Markdown and email, where frames don't work, an embedded page becomes a link to it.

Some sites don't allow their pages to be shown on other sites (with the `X-Frame-Options` or
`Content-Security-Policy: frame-ancestors` headers): the frame then stays empty, and the site's own
"embed" link is the one to use. For YouTube and Vimeo, use **Video**.

### Settings

```ts
pluginOptions: {
  pageembed: {
    sizes: [
      { value: 'nova-pageembed--16by9' },
      { text: 'Tall', value: 'embed-tall' }, // your own class, styled by your CSS
    ],
    allowUrl: (url) => ['maps.example.com', 'forms.example.com'].includes(new URL(url).hostname),
  },
}
```

| Option         | Meaning                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `sizes`        | the sizes besides a fixed one: a class each; `…--16by9` fills the width at 16:9. `[]`: only a fixed size |
| `inlineStyles` | `false`: the sizes only as classes, for your CSS                                                         |
| `className`    | the wrapper's class (`nova-pageembed`)                                                                   |
| `sandbox`      | the frame's sandbox, `allow-*` words; `false`: no sandbox                                                |
| `allowUrl`     | which addresses may be embedded (every `http` and `https` one by default)                                |

### What the frame can and can't do

Only absolute `http` and `https` addresses are embedded, and never one with a name and password in
it; the check runs when HTML is read, when a document arrives as JSON and on output. An `<iframe>`
on its own isn't an embedded page, so pasting a web page doesn't bring along its ads and trackers:
only the plugin's wrapper with a frame in it is.

The sandbox lets the page run its scripts, use its own cookies and storage, send its forms and open
links in a new tab, which most embeddable pages need. It doesn't let the page navigate the page that
shows it, start downloads, show alert dialogs, or use the camera, microphone or location.

If people who can't be trusted write your documents, use `allowUrl` to name the sites they may
embed. And if your own site serves files people upload (HTML among them) from its own domain, keep
that domain out of `allowUrl`: a page from your own domain, with `allow-scripts` and
`allow-same-origin`, can reach the page it is shown on.

## Coming from TinyMCE

`plugins: 'media pageembed'` with `tinymce.init()` works. Embedded pages saved by TinyMCE keep their
`tiny-pageembed` classes and sizes: `tiny_pageembed_classes` lists the sizes and
`tiny_pageembed_inline_styles` turns the inline styles on (they are off there by default, so the
classes and your CSS for them keep working).
