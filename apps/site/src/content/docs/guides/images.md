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

## Smaller files, no camera metadata

Before an image is uploaded (or embedded, without `uploadImage`), the editor prepares it in the
browser:

- a photo larger than 2560 pixels on a side is scaled down, so a 12-megapixel phone photo of 4 MB
  becomes a few hundred kilobytes;
- what the camera wrote into the file besides the picture — EXIF and XMP, with the place where the
  photo was taken, the camera and the date — is left out, so a pasted photo doesn't share your
  location;
- the photo keeps its orientation: a picture the phone stored sideways arrives standing upright.

A file that needs none of this goes as it is, byte for byte. GIF, SVG and animated WebP never
change, PNG stays PNG and a BMP becomes PNG. The work happens in the browser, before anything is
sent.

```ts
createEditor({
  element,
  uploadImage,
  imageOptimize: { maxWidth: 1920, maxHeight: 1920, quality: 0.8 },
  // imageOptimize: { keepMetadata: true }, // keep EXIF and the place
  // imageOptimize: false,                  // upload files as they are
});
```

| Option         | Default | What it does                                   |
| -------------- | ------- | ---------------------------------------------- |
| `maxWidth`     | `2560`  | the largest width in pixels                    |
| `maxHeight`    | `2560`  | the largest height in pixels                   |
| `quality`      | `0.85`  | JPEG and WebP quality, from 0 to 1             |
| `keepMetadata` | `false` | keep EXIF, XMP and IPTC (the place of a photo) |

## Cloud storage

`@novaprose/core/upload` has ready `uploadImage` functions for cloud storage. Keys never reach the
browser: your server signs each upload, or the service takes a key or preset made for browsers.

```ts
import { signedUpload } from '@novaprose/core/upload';

createEditor({
  element,
  uploadImage: signedUpload(async (file) => {
    const response = await fetch('/api/sign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: file.type, size: file.size }),
    });
    if (!response.ok) throw new Error('The image can’t be uploaded');
    return response.json();
  }),
});
```

| Function                                        | For                                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signedUpload(sign)`                            | Amazon S3 and storage that speaks its protocol (Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2), and Google Cloud Storage: your server answers with a signed address |
| `azureBlobUpload(sign)`                         | Azure Blob Storage: your server answers with a SAS address for the blob                                                                                                       |
| `cloudinaryUpload({ cloudName, uploadPreset })` | Cloudinary, with an unsigned upload preset, or `sign` for parameters your server signs                                                                                        |
| `uploadcareUpload({ publicKey })`               | Uploadcare, with the project's public key; `sign` for signed uploads, `cdnBase` for your delivery address                                                                     |

What `sign` gives back: `{ url, method, headers, fields, publicUrl }`. `url` is the signed address
the file is sent to. `method: 'POST'` with `fields` is an S3 presigned POST: the fields go first and
the file last. `headers` are the ones the signature covers. `publicUrl` is where the image is shown
from; without it, the address without its query, or for a POST the address and the key. Progress is
reported while the file goes, and an address that isn't `http(s)` is refused.

The storage must accept uploads from your site: in its CORS settings, your origin, `PUT` or `POST`,
and the headers the upload sends. Anyone with an image's address can see it, as with any image on a
page.

### Signing on your server

Your server chooses the image's name and checks its type and size before signing, so a browser
can't overwrite other files or upload anything else. The example is for Node.js; storage libraries
for other languages sign the same way.

```js
// sign-upload.js: your server decides where an image goes and signs one upload of it.
import { randomUUID } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Storage } from '@google-cloud/storage';
import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

// Only images, at most 10 MB; the name is chosen here, never by the browser.
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const MAX_BYTES = 10 * 1024 * 1024;

function keyFor({ type, size }) {
  const ext = TYPES[type];
  if (!ext || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) return null;
  return `images/${randomUUID()}.${ext}`;
}

/** Amazon S3 (and R2, MinIO, Spaces…): a presigned POST that only takes this type and size. */
export async function signS3(s3, bucket, file) {
  const key = keyFor(file);
  if (!key) return null;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_BYTES],
      ['eq', '$Content-Type', file.type],
    ],
    Fields: { 'Content-Type': file.type },
    Expires: 300,
  });
  return { url, method: 'POST', fields };
}

/** Google Cloud Storage: a V4 signed URL for one PUT of this type and size. */
export async function signGcs(bucket, file) {
  const key = keyFor(file);
  if (!key) return null;
  const headers = { 'x-goog-content-length-range': `0,${MAX_BYTES}` };
  const [url] = await bucket.file(key).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 5 * 60 * 1000,
    contentType: file.type,
    extensionHeaders: headers,
  });
  return {
    url,
    headers: { ...headers, 'Content-Type': file.type },
    publicUrl: `https://storage.googleapis.com/${bucket.name}/${key}`,
  };
}

/** Azure Blob Storage: a SAS for creating this one blob, for five minutes. */
export function signAzure(credential, container, file) {
  const key = keyFor(file);
  if (!key) return null;
  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: key,
      permissions: BlobSASPermissions.parse('cw'),
      expiresOn: new Date(Date.now() + 5 * 60 * 1000),
      contentType: file.type,
    },
    credential,
  );
  const url = `https://${credential.accountName}.blob.core.windows.net/${container}/${key}`;
  return { url: `${url}?${sas}`, headers: { 'Content-Type': file.type } };
}

// The clients, created once:
export const clients = () => ({
  s3: new S3Client({ region: process.env.AWS_REGION }),
  gcs: new Storage().bucket(process.env.GCS_BUCKET),
  azure: new StorageSharedKeyCredential(process.env.AZURE_ACCOUNT, process.env.AZURE_KEY),
});
```

Then the route, behind your sign-in (here with Express):

```js
const { s3 } = clients();

app.post('/api/sign-upload', requireSignedIn, express.json({ limit: '1kb' }), async (req, res) => {
  const signed = await signS3(s3, process.env.S3_BUCKET, req.body ?? {});
  if (!signed) return res.status(400).end();
  res.json(signed);
});
```

`signGcs(clients().gcs, req.body)` and `signAzure(clients().azure, container, req.body)` answer the
same way; use `azureBlobUpload` in the browser for Azure.

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
