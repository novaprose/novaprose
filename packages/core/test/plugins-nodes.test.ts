import { NodeSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { parseMediaUrl } from '../src/plugins/media';

/** Плагины с узлами документа: anchor, pagebreak, media. */

const editors: Editor[] = [];
function mount(content: string, plugins: string[], toolbar?: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, plugins, ...(toolbar ? { toolbar } : {}) });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function submitDialog(fields: string[]): void {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input')];
  fields.forEach((value, i) => (inputs[i]!.value = value));
  document.querySelector<HTMLFormElement>('form.nova-dialog')!.requestSubmit();
}

describe('anchor', () => {
  it('HTML туда-обратно без изменений; name из старого HTML — тоже якорь', () => {
    const editor = mount('<h2><a id="intro"></a>Intro</h2><p><a name="old"></a>text</p>', [
      'anchor',
    ]);
    expect(editor.getHTML()).toBe('<h2><a id="intro"></a>Intro</h2><p><a id="old"></a>text</p>');
  });

  it('недопустимый идентификатор не становится якорем', () => {
    const editor = mount('<p><a id="x y"></a><a id="1abc"></a><a id=\'a"b\'></a>t</p>', ['anchor']);
    expect(editor.getHTML()).toBe('<p>t</p>');
  });

  it('диалог вставляет якорь, повторно — переименовывает выделенный', async () => {
    const editor = mount('<p>Section</p>', ['anchor'], 'anchor');
    // Кнопки плагина регистрирует его ленивая часть — после editor.ready.
    await editor.ready;
    editor.root.querySelector<HTMLElement>('[data-control="anchor"]')!.click();
    submitDialog(['bad id']);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain(
      'starting with a letter',
    );
    submitDialog(['section-1']);
    await new Promise((r) => setTimeout(r, 0));
    expect(editor.getHTML()).toBe('<p><a id="section-1"></a>Section</p>');

    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, 1)));
    editor.root.querySelector<HTMLElement>('[data-control="anchor"]')!.click();
    submitDialog(['section-2']);
    await new Promise((r) => setTimeout(r, 0));
    expect(editor.getHTML()).toBe('<p><a id="section-2"></a>Section</p>');
  });
});

describe('pagebreak', () => {
  it('HTML туда-обратно; разрыв из других редакторов распознаётся', () => {
    const editor = mount(
      '<p>a</p><div class="nova-pagebreak" style="break-after: page;"></div><p>b</p><div style="page-break-after: always"></div><p>c</p>',
      ['pagebreak'],
    );
    expect(editor.getHTML()).toBe(
      '<p>a</p><div class="nova-pagebreak" style="break-after: page;"></div><p>b</p><div class="nova-pagebreak" style="break-after: page;"></div><p>c</p>',
    );
  });

  it('кнопка вставляет разрыв', async () => {
    const editor = mount('<p>a</p>', ['pagebreak'], 'pagebreak');
    await editor.ready;
    editor.root.querySelector<HTMLElement>('[data-control="pagebreak"]')!.click();
    expect(editor.getHTML()).toContain(
      '<div class="nova-pagebreak" style="break-after: page;"></div>',
    );
  });
});

describe('media', () => {
  it.each([
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    [
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://cdn.example.com/clip.mp4', 'https://cdn.example.com/clip.mp4'],
  ])('распознаёт %s', (url, src) => {
    expect(parseMediaUrl(url)?.src).toBe(src);
  });

  it.each([
    'https://evil.example.com/embed',
    'javascript:alert(1)',
    'http://cdn.example.com/clip.mp4',
    'https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
  ])('не принимает %s', (url) => {
    expect(parseMediaUrl(url)).toBeNull();
  });

  it('HTML туда-обратно без изменений', () => {
    const html =
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360" title="Demo" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><video src="https://cdn.example.com/clip.mp4" controls="" width="560" height="315"></video>';
    expect(mount(html, ['media']).getHTML()).toBe(html);
  });

  it('чужие iframe и опасные адреса отбрасываются; без плагина видео не встраивается вовсе', () => {
    const html =
      '<iframe src="https://evil.example.com/x"></iframe><iframe src="javascript:alert(1)"></iframe><p>ok</p>';
    expect(mount(html, ['media']).getHTML()).toBe('<p>ok</p>');
    expect(
      mount('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', []).getHTML(),
    ).toBe('<p></p>');
  });

  it('диалог вставляет видео по обычной ссылке YouTube', async () => {
    const editor = mount('<p></p>', ['media'], 'media');
    await editor.ready;
    editor.root.querySelector<HTMLElement>('[data-control="media"]')!.click();
    submitDialog(['https://evil.example.com/v']);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[role="dialog"]')!.textContent).toContain('not supported');
    submitDialog(['https://youtu.be/dQw4w9WgXcQ', 'Launch video']);
    await new Promise((r) => setTimeout(r, 0));
    expect(editor.getHTML()).toContain(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="560" height="315" title="Launch video"',
    );
    // В редакторе плеер закрыт слоем для выделения.
    expect(editor.root.querySelector('.nova-media .nova-media-overlay')).not.toBeNull();
  });
});
