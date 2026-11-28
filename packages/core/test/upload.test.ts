import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { azureBlobUpload, cloudinaryUpload, signedUpload, uploadcareUpload } from '../src/upload';

/** Upload adapters: the request each service expects, the address it gives back, the checks. */

interface Sent {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  withCredentials: boolean;
}

let sent: Sent[] = [];
let reply: { status: number; text: string } = { status: 200, text: '' };

/** A stand-in XMLHttpRequest: records the request, reports progress, answers with `reply`. */
class FakeXHR {
  status = 0;
  responseText = '';
  withCredentials = false;
  timeout = 0;
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  private request: Sent = { method: '', url: '', headers: {}, body: null, withCredentials: false };
  open(method: string, url: string) {
    this.request = { method, url, headers: {}, body: null, withCredentials: false };
  }
  setRequestHeader(name: string, value: string) {
    this.request.headers[name] = value;
  }
  send(body: unknown) {
    this.request.body = body;
    this.request.withCredentials = this.withCredentials;
    sent.push(this.request);
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
      if (reply.status === 0) {
        this.onerror?.();
        return;
      }
      this.status = reply.status;
      this.responseText = reply.text;
      this.onload?.();
    });
  }
}

beforeEach(() => {
  sent = [];
  reply = { status: 200, text: '' };
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});
afterEach(() => vi.unstubAllGlobals());

const file = () => new File(['png-bytes'], 'photo.png', { type: 'image/png' });
const form = (body: unknown) =>
  [...(body as FormData).entries()].map(([k, v]) => [
    k,
    typeof v === 'string' ? v : (v as File).name,
  ]);

describe('signedUpload', () => {
  it('PUT to the address your server signed; the image is shown from it without the query', async () => {
    const progress = vi.fn();
    const sign = vi.fn(async (f: File) => ({
      url: `https://bucket.s3.amazonaws.com/images/${f.name}?X-Amz-Signature=abc`,
    }));
    const url = await signedUpload(sign)(file(), progress);
    expect(url).toBe('https://bucket.s3.amazonaws.com/images/photo.png');
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: 'https://bucket.s3.amazonaws.com/images/photo.png?X-Amz-Signature=abc',
      headers: { 'Content-Type': 'image/png' },
      withCredentials: false,
    });
    expect(sent[0]!.body).toBeInstanceOf(File);
    expect(progress.mock.calls.map((c) => c[0])).toEqual([50, 100]);
  });

  it('an S3 presigned POST: its fields first, the file last; the key gives the address', async () => {
    reply = { status: 204, text: '' };
    const url = await signedUpload(async () => ({
      url: 'https://bucket.s3.amazonaws.com/',
      method: 'POST',
      fields: { key: 'uploads/${filename}', policy: 'p', 'x-amz-signature': 's' },
    }))(file(), () => {});
    expect(url).toBe('https://bucket.s3.amazonaws.com/uploads/photo.png');
    expect(form(sent[0]!.body)).toEqual([
      ['key', 'uploads/${filename}'],
      ['policy', 'p'],
      ['x-amz-signature', 's'],
      ['file', 'photo.png'],
    ]);
  });

  it('a refusal, a network error or an unsafe address is an error, never an image', async () => {
    reply = { status: 403, text: '<Error>AccessDenied</Error>' };
    await expect(
      signedUpload(async () => ({ url: 'https://s3.example.com/x?sig' }))(file(), () => {}),
    ).rejects.toThrow('refused the upload (403)');
    reply = { status: 0, text: '' };
    await expect(
      signedUpload(async () => ({ url: 'https://s3.example.com/x?sig' }))(file(), () => {}),
    ).rejects.toThrow('failed');
    reply = { status: 200, text: '' };
    for (const bad of ['javascript:alert(1)', '/relative', 42, null]) {
      await expect(
        signedUpload(async () => ({ url: bad as string }))(file(), () => {}),
      ).rejects.toThrow('no usable image address');
    }
    await expect(
      signedUpload(async () => ({
        url: 'https://s3.example.com/x',
        publicUrl: 'javascript:alert(1)',
      }))(file(), () => {}),
    ).rejects.toThrow('no usable image address');
  });
});

describe('azureBlobUpload', () => {
  it('PUT a block blob to the SAS address', async () => {
    reply = { status: 201, text: '' };
    const url = await azureBlobUpload(async () => ({
      url: 'https://acct.blob.core.windows.net/images/photo.png?sv=2024&sig=x',
    }))(file(), () => {});
    expect(url).toBe('https://acct.blob.core.windows.net/images/photo.png');
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'image/png' },
    });
  });
});

describe('cloudinaryUpload', () => {
  it('an unsigned preset: the form Cloudinary expects; its secure_url is the image', async () => {
    reply = {
      status: 200,
      text: JSON.stringify({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/photo.png',
      }),
    };
    const url = await cloudinaryUpload({
      cloudName: 'demo',
      uploadPreset: 'unsigned_web',
      folder: 'posts',
    })(file(), () => {});
    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/v1/photo.png');
    expect(sent[0]!.url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(form(sent[0]!.body)).toEqual([
      ['upload_preset', 'unsigned_web'],
      ['folder', 'posts'],
      ['file', 'photo.png'],
    ]);
  });

  it('signed: the parameters your server signed; no preset, no secret', async () => {
    reply = {
      status: 200,
      text: JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/a.png' }),
    };
    await cloudinaryUpload({
      cloudName: 'demo',
      sign: async () => ({ api_key: '123', timestamp: '1700000000', signature: 'sig' }),
    })(file(), () => {});
    expect(form(sent[0]!.body)).toEqual([
      ['api_key', '123'],
      ['timestamp', '1700000000'],
      ['signature', 'sig'],
      ['file', 'photo.png'],
    ]);
  });

  it('a wrong cloud name or no preset is refused; an answer without an https address too', async () => {
    expect(() => cloudinaryUpload({ cloudName: 'evil.com/x?' })).toThrow('cloudName');
    await expect(cloudinaryUpload({ cloudName: 'demo' })(file(), () => {})).rejects.toThrow(
      'uploadPreset',
    );
    reply = { status: 200, text: JSON.stringify({ secure_url: 'javascript:alert(1)' }) };
    await expect(
      cloudinaryUpload({ cloudName: 'demo', uploadPreset: 'p' })(file(), () => {}),
    ).rejects.toThrow('no usable image address');
  });
});

describe('uploadcareUpload', () => {
  it('the public key and the file; the CDN address of the file id', async () => {
    reply = { status: 200, text: JSON.stringify({ file: '17be4678-dab7-4bc7-8753-28914a22960a' }) };
    const url = await uploadcareUpload({ publicKey: 'demopublickey' })(file(), () => {});
    expect(url).toBe('https://ucarecdn.com/17be4678-dab7-4bc7-8753-28914a22960a/');
    expect(sent[0]!.url).toBe('https://upload.uploadcare.com/base/');
    expect(form(sent[0]!.body)).toEqual([
      ['UPLOADCARE_PUB_KEY', 'demopublickey'],
      ['UPLOADCARE_STORE', 'auto'],
      ['file', 'photo.png'],
    ]);
  });

  it('signed uploads and your delivery address; a strange file id is refused', async () => {
    reply = { status: 200, text: JSON.stringify({ file: 'abcdef12-0000' }) };
    const url = await uploadcareUpload({
      publicKey: 'k',
      store: true,
      cdnBase: 'https://example.ucarecd.net/',
      sign: async () => ({ signature: 's', expire: 1700000000 }),
    })(file(), () => {});
    expect(url).toBe('https://example.ucarecd.net/abcdef12-0000/');
    expect(form(sent[0]!.body)).toEqual([
      ['UPLOADCARE_PUB_KEY', 'k'],
      ['UPLOADCARE_STORE', '1'],
      ['signature', 's'],
      ['expire', '1700000000'],
      ['file', 'photo.png'],
    ]);
    reply = { status: 200, text: JSON.stringify({ file: '../../x' }) };
    await expect(uploadcareUpload({ publicKey: 'k' })(file(), () => {})).rejects.toThrow(
      'no file id',
    );
  });
});
