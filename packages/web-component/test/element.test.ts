import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { registerLanguage } from '@novaprose/core';
import { defineNovaProseEditor, type NovaProseEditorElement } from '../src';

beforeAll(() => defineNovaProseEditor());
afterEach(() => {
  document.body.innerHTML = '';
});

function create(html: string): NovaProseEditorElement {
  document.body.innerHTML = html;
  return document.querySelector('novaprose-editor, my-editor') as NovaProseEditorElement;
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('<novaprose-editor>', () => {
  it('разметка внутри тега становится начальным содержимым', () => {
    const el = create('<novaprose-editor><p>Привет, <strong>мир</strong></p></novaprose-editor>');
    expect(el.editor).not.toBeNull();
    expect(el.value).toBe('<p>Привет, <strong>мир</strong></p>');
    expect(el.querySelector('.nova-editor')).not.toBeNull();
  });

  it('атрибут value важнее разметки; опасное содержимое вычищается', () => {
    const el = create(
      '<novaprose-editor value="<p>из атрибута</p>"><p>из разметки</p></novaprose-editor>',
    );
    expect(el.value).toBe('<p>из атрибута</p>');
    el.value = '<p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)></p>';
    expect(el.value).not.toContain('javascript:');
    expect(el.value).not.toContain('onerror');
  });

  it('атрибуты настраивают редактор, init — любые опции', () => {
    const el = document.createElement('novaprose-editor');
    el.init = { statusbar: false };
    el.setAttribute('toolbar', 'bold italic');
    el.setAttribute('menubar', '');
    el.setAttribute('placeholder', 'Пишите…');
    document.body.append(el);
    expect(el.querySelector('.nova-menubar')).not.toBeNull();
    expect(el.querySelector('.nova-statusbar')).toBeNull();
    expect(el.innerHTML).toContain('Пишите…');
  });

  it('value, выставленный до подключения, применяется при подключении', () => {
    const el = document.createElement('novaprose-editor');
    el.value = '<p>заранее</p>';
    expect(el.value).toBe('<p>заранее</p>');
    document.body.append(el);
    expect(el.editor!.getHTML()).toBe('<p>заранее</p>');
  });

  it('ввод даёт событие input; установка value — нет и без истории', () => {
    const el = create('<novaprose-editor><p>a</p></novaprose-editor>');
    const onInput = vi.fn();
    el.addEventListener('input', onInput);
    el.value = '<p>b</p>';
    expect(onInput).not.toHaveBeenCalled();
    expect(el.editor!.can('undo')).toBe(false);
    el.editor!.setContent('<p>c</p>');
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('запись того же value не трогает документ и выделение (двусторонняя привязка)', () => {
    const el = create('<novaprose-editor><p>abc</p></novaprose-editor>');
    const editor = el.editor!;
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 3)),
    );
    const before = editor.view.state;
    const same = el.value;
    el.value = same;
    expect(editor.view.state).toBe(before);
  });

  it('readonly и disabled выключают редактирование на лету', () => {
    const el = create('<novaprose-editor><p>a</p></novaprose-editor>');
    el.setAttribute('readonly', '');
    expect(el.editor!.isEditable()).toBe(false);
    el.removeAttribute('readonly');
    el.setAttribute('disabled', '');
    expect(el.editor!.isEditable()).toBe(false);
    el.removeAttribute('disabled');
    expect(el.editor!.isEditable()).toBe(true);
  });

  it('язык с загрузчиком: редактор — после загрузки пакета, сразу с переводом', async () => {
    let release!: () => void;
    registerLanguage(
      'qw',
      () => new Promise((resolve) => (release = () => resolve({ bold: 'B (qw)' }))),
    );
    const ready = vi.fn();
    document.addEventListener('novaprose-ready', ready);
    const el = create('<novaprose-editor language="qw" toolbar="bold"><p>x</p></novaprose-editor>');
    // Пока язык грузится, видна исходная разметка; редактора ещё нет.
    expect(el.editor).toBeNull();
    expect(el.innerHTML).toBe('<p>x</p>');
    release();
    await vi.waitFor(() => expect(el.editor).not.toBeNull());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-control="bold"]')?.getAttribute('aria-label')).toBe('B (qw)');
    expect(el.value).toBe('<p>x</p>');
    document.removeEventListener('novaprose-ready', ready);
  });

  it('язык не загрузился — редактор всё равно создаётся, на английском', async () => {
    registerLanguage('qx', async () => {
      throw new Error('offline');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = create('<novaprose-editor language="qx" toolbar="bold"></novaprose-editor>');
    await vi.waitFor(() => expect(el.editor).not.toBeNull());
    expect(el.querySelector('[data-control="bold"]')?.getAttribute('aria-label')).toMatch(/^Bold/);
    warn.mockRestore();
  });

  it('событие novaprose-ready несёт экземпляр', () => {
    const onReady = vi.fn();
    document.addEventListener('novaprose-ready', onReady, { once: true });
    const el = create('<novaprose-editor></novaprose-editor>');
    expect(onReady).toHaveBeenCalledOnce();
    expect((onReady.mock.calls[0]![0] as CustomEvent).detail.editor).toBe(el.editor);
  });

  it('перенос в DOM сохраняет экземпляр, удаление — уничтожает', async () => {
    const el = create(
      '<div id="a"><novaprose-editor><p>a</p></novaprose-editor></div><div id="b"></div>',
    );
    const editor = el.editor!;
    document.getElementById('b')!.append(el);
    await flush();
    expect(el.editor).toBe(editor);
    el.remove();
    await flush();
    expect(el.editor).toBeNull();
    // Содержимое не теряется: при повторном подключении редактор создаётся заново с ним.
    document.body.append(el);
    expect(el.value).toBe('<p>a</p>');
  });

  it('свой тег через defineNovaProseEditor(name)', () => {
    defineNovaProseEditor('my-editor');
    defineNovaProseEditor('my-editor'); // повторно — без ошибки
    const el = create('<my-editor><p>свой</p></my-editor>');
    expect(el.editor!.getHTML()).toBe('<p>свой</p>');
  });

  it('focus() ставит фокус в текст', () => {
    const el = create('<novaprose-editor><p>a</p></novaprose-editor>');
    el.focus();
    expect(document.activeElement).toBe(el.editor!.view.dom);
  });

  it('скрипт в <head>: ждёт конца разбора документа, чтобы не потерять вложенную разметку', () => {
    // Регрессия: при document.readyState === 'loading' элемент подключается до своих детей.
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    try {
      const el = document.createElement('novaprose-editor');
      document.body.append(el);
      expect(el.editor).toBeNull();
      el.innerHTML = '<p>дочитали</p>';
      Object.defineProperty(document, 'readyState', { value: 'interactive', configurable: true });
      document.dispatchEvent(new Event('DOMContentLoaded'));
      expect(el.value).toBe('<p>дочитали</p>');
    } finally {
      delete (document as unknown as Record<string, unknown>).readyState;
    }
  });
});
