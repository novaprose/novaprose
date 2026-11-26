/**
 * ZIP для .docx без сторонних библиотек: сжатие — встроенные CompressionStream / DecompressionStream
 * (deflate-raw есть во всех современных браузерах и в Node 18+). Дата файлов постоянная —
 * один и тот же документ даёт одни и те же байты.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const encoder = new TextEncoder();

let crcTable: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Прогнать байты через поток сжатия или распаковки. */
async function through(data: Uint8Array, transform: TransformStream<Uint8Array, Uint8Array>) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  }).pipeThrough(transform);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const canCompress = () => typeof CompressionStream !== 'undefined';

/** Собрать ZIP. Сжатие — deflate (если браузер умеет), иначе файлы хранятся как есть. */
export async function zip(entries: ZipEntry[]): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const deflate = canCompress() && entry.data.length > 64;
    const body = deflate
      ? await through(
          entry.data,
          new CompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>,
        )
      : entry.data;
    const method = deflate ? 8 : 0;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // версия для распаковки
    local.setUint16(6, 0x0800, true); // имена в UTF-8
    local.setUint16(8, method, true);
    local.setUint16(10, 0, true); // время 00:00
    local.setUint16(12, 0x21, true); // дата 1980-01-01
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, entry.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, body);

    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, 20, true);
    record.setUint16(6, 20, true);
    record.setUint16(8, 0x0800, true);
    record.setUint16(10, method, true);
    record.setUint16(12, 0, true);
    record.setUint16(14, 0x21, true);
    record.setUint32(16, crc, true);
    record.setUint32(20, body.length, true);
    record.setUint32(24, entry.data.length, true);
    record.setUint16(28, name.length, true);
    record.setUint32(42, offset, true);
    central.push(new Uint8Array(record.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const parts = [...locals, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Файлы ZIP по именам. Шифрование и ZIP64 не поддерживаются (в .docx их не бывает). */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('Not a ZIP file');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('Damaged ZIP file');
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (flags & 1) throw new Error('Encrypted documents are not supported');
    const start =
      offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined')
        throw new Error('This browser cannot unpack compressed files');
      files.set(
        name,
        await through(
          raw,
          new DecompressionStream('deflate-raw') as TransformStream<Uint8Array, Uint8Array>,
        ),
      );
    } else throw new Error(`Unsupported compression in ${name}`);
  }
  return files;
}
