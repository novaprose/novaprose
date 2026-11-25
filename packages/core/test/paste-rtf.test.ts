import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { dataUrlToFile } from '../src/image';
import { extractRtfImages, replaceLocalImages } from '../src/paste-rtf';

// 1×1 PNG и заголовок JPEG — для проверки сигнатур достаточно.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_HEX = Buffer.from(PNG_BASE64, 'base64').toString('hex');
const JPEG_HEX = 'ffd8ffe000104a46494600010100000100010000ffd9';

/** RTF в том виде, как Word кладёт картинки в буфер: основная копия (\shppict) и резервная WMF. */
function wordRtf(): string {
  const split = (hex: string) => hex.match(/.{1,64}/g)!.join('\r\n');
  return [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Calibri;}}',
    '\\pard\\plain Text before {\\*\\shppict{\\pict{\\*\\picprop\\shplid1025{\\sp{\\sn shapeType}{\\sv 75}}}',
    `\\picscalex100\\picscaley100\\picw26\\pich26\\picwgoal15\\pichgoal15\\pngblip\\bliptag-1234{\\*\\blipuid 00ff}\r\n${split(PNG_HEX)}}}`,
    '{\\nonshppict{\\pict\\picscalex100\\picw26\\pich26\\wmetafile8\\bliptag-1234{\\*\\blipuid 00ff}0100090000036e00000000}}',
    ' and {\\*\\shppict{\\pict\\picw10\\pich10\\jpegblip\\bliptag42 ',
    `${split(JPEG_HEX)}}}{\\nonshppict{\\pict\\wmetafile8 010009}}`,
    ' and a broken one {\\*\\shppict{\\pict\\pngblip 00112233}}',
    '\\par}',
  ].join('');
}

const WORD_HTML =
  '<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal>Text before ' +
  '<!--[if gte vml 1]><v:shape><v:imagedata src="file:///C:/Users/a/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png"/></v:shape><![endif]-->' +
  '<![if !vml]><img width=26 height=26 src="file:///C:/Users/a/AppData/Local/Temp/msohtmlclip1/01/clip_image002.png" v:shapes="Picture_x0020_1"><![endif]>' +
  ' and <![if !vml]><img width=10 height=10 src="file:///C:/Users/a/AppData/Local/Temp/msohtmlclip1/01/clip_image003.jpg"><![endif]>' +
  '<o:p></o:p></p>';

describe('Картинки из RTF буфера Word', () => {
  it('достаёт PNG и JPEG по порядку, пропускает резервные WMF и неверные данные', () => {
    const images = extractRtfImages(wordRtf());
    expect(images.map((i) => i.type)).toEqual(['image/png', 'image/jpeg']);
    expect(images[0]!.base64).toBe(PNG_BASE64);
    expect(Buffer.from(images[1]!.base64, 'base64').toString('hex')).toBe(JPEG_HEX);
  });

  it('подставляет картинки только при совпадении количества', () => {
    const images = extractRtfImages(wordRtf());
    const replaced = replaceLocalImages(WORD_HTML, images);
    // file: остаётся только внутри VML-комментария, который очистка вставки выбрасывает.
    expect(replaced).not.toMatch(/<img[^>]+src="file:/);
    expect(replaced).toContain(`src="data:image/png;base64,${PNG_BASE64}"`);
    expect(replaced).toContain('src="data:image/jpeg;base64,');
    // Одна картинка в RTF на две в HTML — не угадываем, оставляем как есть.
    expect(replaceLocalImages(WORD_HTML, images.slice(0, 1))).toBe(WORD_HTML);
  });
});

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(options: Partial<Parameters<typeof createEditor>[0]> = {}): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content: '<p></p>', ...options });
  editors.push(editor);
  return editor;
}

function pasteEvent(editor: Editor, data: Record<string, string>): void {
  const clipboardData = {
    getData: (type: string) => data[type] ?? '',
    types: Object.keys(data),
    files: [] as File[],
    items: [],
  };
  const event = new ClipboardEvent('paste', {
    clipboardData: clipboardData as unknown as DataTransfer,
    bubbles: true,
    cancelable: true,
  });
  editor.view.dom.dispatchEvent(event);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Вставка из Word с картинками', () => {
  it('картинки из RTF попадают в документ вместо file:-ссылок', () => {
    const editor = mount();
    pasteEvent(editor, { 'text/html': WORD_HTML, 'text/rtf': wordRtf(), 'text/plain': 'Text' });
    const html = editor.getHTML();
    expect(html).toContain(
      `<img src="data:image/png;base64,${PNG_BASE64}" width="26" height="26">`,
    );
    expect(html).toContain('<img src="data:image/jpeg;base64,');
    expect(html).not.toContain('file:');
  });

  it('без RTF картинки с file:-ссылками по-прежнему не вставляются', () => {
    const editor = mount();
    pasteEvent(editor, { 'text/html': WORD_HTML, 'text/plain': 'Text' });
    expect(editor.getHTML()).toBe('<p>Text before and</p>');
  });

  it('с uploadImage вставленные картинки загружаются и заменяются адресом', async () => {
    const uploaded: File[] = [];
    const editor = mount({
      uploadImage: async (file) => {
        uploaded.push(file);
        return `https://cdn.example.com/${uploaded.length}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
      },
    });
    pasteEvent(editor, { 'text/html': WORD_HTML, 'text/rtf': wordRtf() });
    await flush();
    await flush();
    expect(uploaded.map((f) => f.type)).toEqual(['image/png', 'image/jpeg']);
    expect(editor.getHTML()).toContain('src="https://cdn.example.com/1.png"');
    expect(editor.getHTML()).toContain('src="https://cdn.example.com/2.jpg"');
    expect(editor.getHTML()).not.toContain('data:image');
    // Подмена адреса — не отдельный шаг отмены: undo убирает саму вставку.
    editor.exec('undo');
    expect(editor.getHTML()).toBe('<p></p>');
  });

  it('ошибка загрузки оставляет картинку встроенной и показывает уведомление', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const editor = mount({ uploadImage: () => Promise.reject(new Error('offline')) });
    pasteEvent(editor, { 'text/html': WORD_HTML, 'text/rtf': wordRtf() });
    await flush();
    await flush();
    expect(editor.getHTML()).toContain('data:image/png;base64,');
    expect(document.body.textContent).toContain('Image upload failed');
  });

  it('dataUrlToFile: только растровые картинки', () => {
    expect(dataUrlToFile(`data:image/png;base64,${PNG_BASE64}`)?.type).toBe('image/png');
    expect(dataUrlToFile('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(dataUrlToFile('https://example.com/a.png')).toBeNull();
  });
});
