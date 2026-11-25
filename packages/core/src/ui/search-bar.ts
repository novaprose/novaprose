import type { Editor } from '../editor';
import {
  clearSearch,
  findNext,
  getSearchState,
  replaceAll,
  replaceCurrent,
  setSearch,
  MAX_MATCHES,
} from '../search';
import { h, icon, uniqueId } from './dom';
import { icons } from './icons';

export interface SearchBarHandle {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Обновить счётчик после изменения документа. */
  update(): void;
  destroy(): void;
}

/**
 * Панель «Найти и заменить» под тулбаром (не модальная: можно править текст, не закрывая её).
 * Enter — следующее, Shift+Enter — предыдущее, Esc — закрыть и вернуться в текст.
 */
export function createSearchBar(editor: Editor, before: HTMLElement): SearchBarHandle {
  const { t } = editor.ui;
  const findId = uniqueId('nova-find');
  const replaceId = uniqueId('nova-replace');

  const findInput = h('input', {
    id: findId,
    type: 'search',
    className: 'nova-input',
    placeholder: t('search.find'),
    'aria-label': t('search.find'),
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const replaceInput = h('input', {
    id: replaceId,
    type: 'text',
    className: 'nova-input',
    placeholder: t('search.replace'),
    'aria-label': t('search.replace'),
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const counter = h('span', { className: 'nova-search-count', 'aria-live': 'polite' });

  const toggle = (label: string, text: string) => {
    const b = h(
      'button',
      {
        type: 'button',
        className: 'nova-btn nova-search-toggle',
        'aria-pressed': 'false',
        'aria-label': label,
        'data-tooltip': label,
      },
      text,
    );
    editor.ui.tooltip.attach(b);
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      run();
      findInput.focus();
    });
    return b;
  };
  const caseToggle = toggle(t('search.matchCase'), 'Aa');
  const wordToggle = toggle(t('search.wholeWord'), 'ab|');

  const iconButton = (svg: string, label: string, onClick: () => void) => {
    const b = h(
      'button',
      { type: 'button', className: 'nova-btn', 'aria-label': label, 'data-tooltip': label },
      icon(svg),
    );
    editor.ui.tooltip.attach(b);
    b.addEventListener('click', onClick);
    return b;
  };
  const prev = iconButton(icons.chevronUp, t('search.prev'), () => {
    editor.exec(findNext(-1));
    findInput.focus();
  });
  const next = iconButton(icons.chevronDown, t('search.next'), () => {
    editor.exec(findNext(1));
    findInput.focus();
  });
  const close = iconButton(icons.close, t('dialog.close'), () => handle.close());

  const replaceOne = h(
    'button',
    { type: 'button', className: 'nova-button' },
    t('search.replaceOne'),
  );
  const replaceAllBtn = h(
    'button',
    { type: 'button', className: 'nova-button' },
    t('search.replaceAll'),
  );
  replaceOne.addEventListener('click', () => {
    sync();
    editor.exec(replaceCurrent(replaceInput.value));
    editor.exec(findNext(1));
    replaceInput.focus();
  });
  replaceAllBtn.addEventListener('click', () => {
    sync();
    editor.exec(replaceAll(replaceInput.value));
    replaceInput.focus();
  });

  const bar = h(
    'div',
    { className: 'nova-search', role: 'search', 'aria-label': t('search.title'), hidden: true },
    h(
      'div',
      { className: 'nova-search-row' },
      findInput,
      counter,
      caseToggle,
      wordToggle,
      prev,
      next,
      close,
    ),
    h('div', { className: 'nova-search-row' }, replaceInput, replaceOne, replaceAllBtn),
  );
  before.parentElement!.insertBefore(bar, before);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    setSearch({
      query: findInput.value,
      caseSensitive: caseToggle.getAttribute('aria-pressed') === 'true',
      wholeWord: wordToggle.getAttribute('aria-pressed') === 'true',
    })(editor.view.state, editor.view.dispatch);
  };

  /** Поле могло измениться без события input (автозаполнение) — сверяем перед действием. */
  const sync = () => {
    if (timer || getSearchState(editor.view.state).query !== findInput.value) run();
  };

  findInput.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    // Небольшая задержка: на большом документе не пересчитываем на каждый символ.
    timer = setTimeout(run, 120);
  });

  findInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sync();
      editor.exec(findNext(event.shiftKey ? -1 : 1));
      // exec переводит фокус в редактор — возвращаем в поле, чтобы жать Enter дальше.
      findInput.focus();
    }
  });
  replaceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      replaceOne.click();
      replaceInput.focus();
    }
  });
  bar.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handle.close();
    }
  });
  // Кнопки не уводят фокус из поля, чтобы Enter продолжал работать.
  bar.addEventListener('mousedown', (event) => {
    if ((event.target as HTMLElement).closest('button')) event.preventDefault();
  });

  const update = () => {
    if (bar.hidden) return;
    const { matches, current, query } = getSearchState(editor.view.state);
    const total = matches.length;
    if (!query) counter.textContent = '';
    else if (!total) counter.textContent = t('search.none');
    else
      counter.textContent = t('search.count', {
        current: current + 1,
        total: total >= MAX_MATCHES ? `${MAX_MATCHES}+` : total,
      });
    bar.classList.toggle('is-empty', !!query && !total);
    for (const b of [prev, next, replaceOne, replaceAllBtn]) b.disabled = !total;
    replaceOne.disabled = !total || !editor.isEditable();
    replaceAllBtn.disabled = !total || !editor.isEditable();
  };

  const handle: SearchBarHandle = {
    open() {
      const wasHidden = bar.hidden;
      bar.hidden = false;
      // Выделенный текст (одна строка) — сразу как запрос, как в браузерах и IDE.
      const { from, to, empty } = editor.view.state.selection;
      const selected = empty ? '' : editor.view.state.doc.textBetween(from, to, ' ');
      if (selected && !selected.includes('\n') && selected.length <= 100)
        findInput.value = selected;
      if (wasHidden || selected) run();
      findInput.focus();
      findInput.select();
      update();
    },
    close() {
      if (bar.hidden) return;
      bar.hidden = true;
      if (timer) clearTimeout(timer);
      clearSearch(editor.view.state, editor.view.dispatch);
      editor.focus();
    },
    isOpen: () => !bar.hidden,
    update,
    destroy() {
      if (timer) clearTimeout(timer);
      bar.remove();
    },
  };
  return handle;
}
