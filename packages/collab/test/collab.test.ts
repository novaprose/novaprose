import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, REMOTE_CHANGE_META, type Editor } from '@novaprose/core';
import { applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { Awareness, collab, colorFor, Y, type CollabParticipant } from '../src';

/**
 * Два редактора со своими Y.Doc, связанные в памяти (как через сервер, но без сети).
 * Проверяем синхронизацию, «свою» отмену и курсоры участников.
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function pair(plugins: string[] = [], onUsersA?: (users: CollabParticipant[]) => void) {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  // Обмен обновлениями документа в обе стороны (без зацикливания: origin = 'remote').
  docA.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(docB, u, 'remote'),
  );
  docB.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(docA, u, 'remote'),
  );
  const awA = new Awareness(docA);
  const awB = new Awareness(docB);
  const bridge = (from: Awareness, to: Awareness) =>
    from.on('update', ({ added, updated, removed }: Record<string, number[]>) => {
      const changed = [...added!, ...updated!, ...removed!];
      applyAwarenessUpdate(to, encodeAwarenessUpdate(from, changed), 'remote');
    });
  bridge(awA, awB);
  bridge(awB, awA);

  const mount = (ydoc: Y.Doc, awareness: Awareness, name: string) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({
      element,
      plugins: [
        ...plugins,
        collab({
          ydoc,
          awareness,
          user: { name },
          ...(name === 'Anna' ? { onUsers: onUsersA } : {}),
        }),
      ],
    });
    editors.push(editor);
    return editor;
  };
  return { a: mount(docA, awA, 'Anna'), b: mount(docB, awB, 'Boris'), awB };
}

function typeAtEnd(editor: Editor, text: string): void {
  const { state } = editor.view;
  const end = TextSelection.atEnd(state.doc);
  editor.view.dispatch(state.tr.setSelection(end).insertText(text));
}

describe('совместное редактирование', () => {
  it('правка соавтора вызывает change, но не input (ввод — только свои правки)', async () => {
    const { a, b } = pair();
    const events: string[] = [];
    const remote: unknown[] = [];
    b.on('change', (_e, { transaction }) => {
      events.push('change');
      remote.push(transaction.getMeta(REMOTE_CHANGE_META));
    });
    b.on('input', () => events.push('input'));
    typeAtEnd(a, 'Anna');
    await tick();
    expect(b.getHTML()).toBe('<p>Anna</p>');
    expect(events).toContain('change');
    expect(events).not.toContain('input');
    // Правка соавтора явно помечена — не только косвенно (addToHistory: false из y-prosemirror).
    expect(remote).toContain(true);
    typeAtEnd(b, '!');
    expect(events.at(-1)).toBe('input');
  });

  it('правки одного участника появляются у другого', async () => {
    const { a, b } = pair();
    a.setContent('<h2>Plan</h2><p>Draft</p>');
    await tick();
    expect(b.getHTML()).toBe('<h2>Plan</h2><p>Draft</p>');
    typeAtEnd(b, ' by Boris');
    await tick();
    expect(a.getHTML()).toBe('<h2>Plan</h2><p>Draft by Boris</p>');
  });

  it('«отменить» откатывает только свои правки, чужие остаются', async () => {
    const { a, b } = pair();
    typeAtEnd(a, 'Anna wrote this.');
    await tick();
    typeAtEnd(b, ' Boris added this.');
    await tick();
    expect(a.getHTML()).toBe('<p>Anna wrote this. Boris added this.</p>');
    expect(a.exec('undo')).toBe(true);
    await tick();
    expect(a.getHTML()).toBe('<p>&nbsp;Boris added this.</p>');
    expect(b.getHTML()).toBe('<p>&nbsp;Boris added this.</p>');
    expect(a.exec('redo')).toBe(true);
    await tick();
    expect(b.getHTML()).toBe('<p>Anna wrote this. Boris added this.</p>');
  });

  it('курсор другого участника виден с именем и цветом', async () => {
    const { a, b } = pair();
    a.setContent('<p>Hello world</p>');
    await tick();
    b.view.focus();
    b.view.dispatch(b.view.state.tr.setSelection(TextSelection.create(b.view.state.doc, 3)));
    await tick();
    await tick();
    const label = a.root.querySelector('.nova-collab-label');
    expect(label?.textContent).toBe('Boris');
    expect((label as HTMLElement).style.backgroundColor).not.toBe('');
  });

  it('имя участника выводится как текст, а не HTML', async () => {
    const { a, b, awB } = pair();
    a.setContent('<p>x</p>');
    await tick();
    // Участник (или злоумышленник) подменяет своё имя на разметку.
    awB.setLocalStateField('user', {
      name: '<img src=x onerror=alert(1)>',
      color: 'red;background:url(x)',
    });
    b.view.focus();
    b.view.dispatch(b.view.state.tr.setSelection(TextSelection.create(b.view.state.doc, 1)));
    await tick();
    await tick();
    const label = a.root.querySelector<HTMLElement>('.nova-collab-label')!;
    expect(label.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(a.root.querySelector('.nova-collab-label img')).toBeNull();
    // Неправильный цвет не попадает в стиль.
    expect(label.getAttribute('style')).not.toContain('url(');
  });

  it('работает с плагинами, добавляющими узлы (своя схема редактора)', async () => {
    const { a, b } = pair(['media']);
    a.setContent(
      '<p>Watch:</p><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>',
    );
    await tick();
    expect(b.getHTML()).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('onUsers сообщает состав участников: свой клиент первым, уход — исчезает', async () => {
    let users: CollabParticipant[] = [];
    const { b, awB } = pair([], (list) => (users = list));
    await tick();
    expect(users.map((u) => [u.name, u.self])).toEqual([
      ['Anna', true],
      ['Boris', false],
    ]);
    expect(users[1]!.color).toBe(colorFor('Boris'));
    awB.setLocalStateField('user', { name: 'Boris K', color: 'url(x)' });
    await tick();
    expect(users[1]).toMatchObject({ name: 'Boris K', color: '#64748b' });
    b.destroy();
    await tick();
    expect(users.map((u) => u.name)).toEqual(['Anna']);
  });

  it('setUser меняет имя для остальных без переподключения', async () => {
    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    const plugin = collab({ ydoc, awareness, user: { name: 'Guest' } });
    const element = document.createElement('div');
    document.body.appendChild(element);
    editors.push(createEditor({ element, plugins: [plugin] }));
    plugin.setUser({ name: 'Anna' });
    expect(awareness.getLocalState()?.user).toEqual({ name: 'Anna', color: colorFor('Anna') });
  });

  it('colorFor даёт одинаковый цвет для одного имени', () => {
    expect(colorFor('Anna')).toBe(colorFor('Anna'));
    expect(colorFor('Anna')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
