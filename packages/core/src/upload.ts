import type { UploadImageHandler } from './image';

/**
 * Upload adapters (`@novaprose/core/upload`): ready `uploadImage` handlers for cloud storage. Keys
 * never reach the browser: your server signs each upload (S3, Google Cloud Storage, Azure), or the
 * service takes a public key or an unsigned preset made for browsers (Uploadcare, Cloudinary).
 *
 *   createEditor({ element, uploadImage: signedUpload((file) => api.sign(file)) });
 */

/** What your server gives for one file: where to send it, and how. */
export interface SignedUpload {
  /** The signed address the file goes to. */
  url: string;
  /** PUT (a presigned S3, Google Cloud Storage or Azure address) or POST (an S3 presigned POST). */
  method?: 'PUT' | 'POST';
  /** Headers the signature covers, such as Content-Type. */
  headers?: Record<string, string>;
  /** For a POST: the form fields to send with the file (an S3 presigned POST's key, policy…). */
  fields?: Record<string, string>;
  /** Where the image is shown from afterwards; by default the address without its query. */
  publicUrl?: string;
}

export interface UploadOptions {
  /** Send cookies with the upload (your own server, not a storage service). */
  withCredentials?: boolean;
  /** Give up after this many milliseconds (60 000). */
  timeout?: number;
}

interface Answer {
  status: number;
  text: string;
}

/** One request with upload progress (fetch can't report it). */
function send(
  method: string,
  url: string,
  body: Blob | FormData,
  headers: Record<string, string>,
  progress: (percent: number) => void,
  options: UploadOptions = {},
): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.withCredentials = options.withCredentials === true;
    xhr.timeout = options.timeout ?? 60_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        progress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => resolve({ status: xhr.status, text: String(xhr.responseText ?? '') });
    xhr.onerror = () => reject(new Error(`The upload to ${hostOf(url)} failed`));
    xhr.ontimeout = () => reject(new Error(`The upload to ${hostOf(url)} took too long`));
    xhr.send(body);
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'the server';
  }
}

/** An address the image may be shown from: absolute http(s). */
function imageAddress(value: unknown): string {
  if (
    typeof value === 'string' &&
    /^https?:\/\/[^\s/?#]/i.test(value.trim()) &&
    value.length <= 4000
  )
    return value.trim();
  throw new Error('The upload service gave no usable image address');
}

const withoutQuery = (url: string) => url.replace(/[?#].*$/, '');

function ok(answer: Answer, service: string): void {
  if (answer.status < 200 || answer.status >= 300)
    throw new Error(`${service} refused the upload (${answer.status})`);
}

function json(answer: Answer): Record<string, unknown> {
  try {
    const value = JSON.parse(answer.text) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Storage your server signs uploads for: Amazon S3 and storage that speaks its protocol (Cloudflare
 * R2, MinIO, DigitalOcean Spaces, Backblaze B2), Google Cloud Storage, Azure Blob Storage. `sign`
 * asks your server for a signed address for this file.
 */
export function signedUpload(
  sign: (file: File) => Promise<SignedUpload>,
  options?: UploadOptions,
): UploadImageHandler {
  return async (file, progress) => {
    const signed = await sign(file);
    const url = imageAddress(signed?.url);
    const headers = { ...(signed.headers ?? {}) };
    if (signed.method === 'POST') {
      // An S3 presigned POST: its fields first, the file last.
      const form = new FormData();
      for (const [name, value] of Object.entries(signed.fields ?? {})) form.append(name, value);
      form.append('file', file);
      ok(await send('POST', url, form, headers, progress, options), hostOf(url));
      const key = (signed.fields?.key ?? '').replace('${filename}', file.name);
      return imageAddress(signed.publicUrl ?? `${withoutQuery(url).replace(/\/?$/, '/')}${key}`);
    }
    if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type'))
      headers['Content-Type'] = file.type || 'application/octet-stream';
    ok(await send('PUT', url, file, headers, progress, options), hostOf(url));
    return imageAddress(signed.publicUrl ?? withoutQuery(url));
  };
}

/** Azure Blob Storage: a SAS address for the blob, from your server. */
export function azureBlobUpload(
  sign: (file: File) => Promise<SignedUpload>,
  options?: UploadOptions,
): UploadImageHandler {
  return signedUpload(async (file) => {
    const signed = await sign(file);
    return {
      ...signed,
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', ...(signed?.headers ?? {}) },
    };
  }, options);
}

export interface CloudinaryOptions extends UploadOptions {
  /** Your cloud's name. */
  cloudName: string;
  /** An unsigned upload preset, made for uploads from browsers. */
  uploadPreset?: string;
  /** Or a signed upload: your server signs the parameters (api_key, timestamp, signature…). */
  sign?: (file: File) => Promise<Record<string, string>>;
  /** A folder for the images. */
  folder?: string;
}

/** Cloudinary: an unsigned preset, or parameters your server signs. */
export function cloudinaryUpload(options: CloudinaryOptions): UploadImageHandler {
  if (!/^[\w-]{1,100}$/.test(options.cloudName ?? ''))
    throw new Error('cloudinaryUpload: cloudName is required');
  const url = `https://api.cloudinary.com/v1_1/${options.cloudName}/image/upload`;
  return async (file, progress) => {
    const form = new FormData();
    if (options.sign) {
      for (const [name, value] of Object.entries(await options.sign(file)))
        form.append(name, value);
    } else if (options.uploadPreset) {
      form.append('upload_preset', options.uploadPreset);
      if (options.folder) form.append('folder', options.folder);
    } else {
      throw new Error('cloudinaryUpload: give uploadPreset or sign');
    }
    form.append('file', file);
    const answer = await send('POST', url, form, {}, progress, options);
    ok(answer, 'Cloudinary');
    return imageAddress(json(answer).secure_url);
  };
}

export interface UploadcareOptions extends UploadOptions {
  /** Your project's public key. */
  publicKey: string;
  /** Signed uploads: your server gives the signature and when it expires. */
  sign?: (file: File) => Promise<{ signature: string; expire: string | number }>;
  /** Keep the file (auto: as the project says). */
  store?: boolean | 'auto';
  /** Your project's delivery address (https://ucarecdn.com). */
  cdnBase?: string;
}

/** Uploadcare: the project's public key, a signature from your server when uploads are signed. */
export function uploadcareUpload(options: UploadcareOptions): UploadImageHandler {
  if (!/^[\w-]{1,100}$/.test(options.publicKey ?? ''))
    throw new Error('uploadcareUpload: publicKey is required');
  const cdn = withoutQuery(options.cdnBase ?? 'https://ucarecdn.com').replace(/\/+$/, '');
  return async (file, progress) => {
    const form = new FormData();
    form.append('UPLOADCARE_PUB_KEY', options.publicKey);
    form.append(
      'UPLOADCARE_STORE',
      options.store === true ? '1' : options.store === false ? '0' : 'auto',
    );
    if (options.sign) {
      const { signature, expire } = await options.sign(file);
      form.append('signature', String(signature));
      form.append('expire', String(expire));
    }
    form.append('file', file);
    const answer = await send(
      'POST',
      'https://upload.uploadcare.com/base/',
      form,
      {},
      progress,
      options,
    );
    ok(answer, 'Uploadcare');
    const id = json(answer).file;
    if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id))
      throw new Error('Uploadcare gave no file id');
    return imageAddress(`${cdn}/${id}/`);
  };
}
