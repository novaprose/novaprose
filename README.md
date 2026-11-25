# NovaProse

Встраиваемый WYSIWYG-редактор нового поколения на [ProseMirror](https://prosemirror.net): MIT, нативные
интеграции, совместная работа в реальном времени, комментарии, история версий и режим правок.

> Статус: 0.x preview. API может меняться. Изменения — в [CHANGELOG.md](CHANGELOG.md).

## Быстрый старт (разработка)

Нужны Node.js 22.23+ (или 24+) и pnpm 9 (`npm i -g pnpm`).

```bash
pnpm install
pnpm dev      # откроется playground на http://localhost:5173
pnpm check    # формат, линт, типы, тесты
```

## Использование

```ts
import { createEditor } from '@novaprose/core';
import '@novaprose/core/style.css';

const editor = createEditor({
  element: document.querySelector('#editor')!,
  content: '<p>Привет, мир</p>',
  language: 'ru',
  placeholder: 'Начните печатать…',
  // Привычный формат тулбара; '|' разделяет группы. При нехватке места лишнее уходит в «⋯».
  toolbar:
    'undo redo | blocks | bold italic underline | forecolor backcolor | link image | bullist numlist',
  // Загрузка картинок на ваш сервер (вставка из буфера, drag-and-drop, диалог).
  uploadImage: async (file, progress) => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/upload', { method: 'POST', body });
    return (await res.json()).url;
  },
  // Свои кнопки — тем же API, что и встроенные.
  setup: (editor) => {
    editor.ui.registry.addButton('signature', {
      text: 'Подпись',
      tooltip: 'Вставить подпись',
      onAction: (e) => e.setContent(e.getHTML() + '<p>— С уважением</p>'),
    });
  },
  onChange: (e) => console.log(e.getHTML()),
});

editor.exec('bold');
editor.getHTML(); // детерминированный HTML, одинаковый во всех браузерах
editor.destroy();
```

Ограничить контент (как `valid_elements` / `invalid_elements` / `valid_styles`):

```ts
createEditor({
  element,
  invalidElements: 'img,table,h1', // или validElements: 'p,strong/b,em/i,a[href],ul,ol'
  validStyles: 'color,text-align',
});
```

Запрещённое не попадёт в документ ни при вставке, ни через горячие клавиши, ни через `setContent`.

Режимы и меню:

```ts
createEditor({ element, mode: 'inline' }); // без рамки, панель над текстом при фокусе
createEditor({ element, mode: 'distraction-free' }); // только панели «по месту» (quickbars)
createEditor({ element, menubar: true }); // Файл · Правка · Вид · Вставка · Формат · Таблица · Справка
```

Горячие клавиши: Ctrl/Cmd+B/I/U, Ctrl/Cmd+K — ссылка, Alt+F10 — перейти на тулбар, Esc — вернуться в текст.
Markdown при наборе: `#`, `-`, `1.`, `>`, ` ``` `.

React:

```tsx
import { NovaProseEditor } from '@novaprose/react';
import '@novaprose/core/style.css';

function App() {
  const [html, setHtml] = useState('<p>Привет</p>');
  return <NovaProseEditor value={html} onChange={setHtml} init={{ menubar: true }} />;
}
```

Хуки для своего интерфейса (`useEditor`, `useEditorState`, `useCommand`), формы и Next.js описаны в
[packages/react/README.md](packages/react/README.md). React-песочница: http://localhost:5173/react.html.

Vue:

```vue
<NovaProseEditor v-model="html" :init="{ menubar: true }" />
```

Подробнее — [packages/vue/README.md](packages/vue/README.md), песочница: http://localhost:5173/vue.html.

Без фреймворка — веб-компонент, работает как обычное поле формы:

```html
<script src="…/novaprose.global.js"></script>
<form method="post">
  <novaprose-editor name="body" required><p>Привет</p></novaprose-editor>
</form>
```

Angular (`ngModel`, Reactive Forms, zoneless, SSR):

```html
<novaprose-editor [formControl]="body" [init]="{ menubar: true }" />
```

Подробнее — [packages/angular/README.md](packages/angular/README.md), песочница: http://localhost:5173/angular.html.

Про веб-компонент — [packages/web-component/README.md](packages/web-component/README.md), песочница:
http://localhost:5173/element.html.

## Структура

| Путь                      | Что это                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `packages/core`           | `@novaprose/core` — ядро редактора                                     |
| `packages/react`          | `@novaprose/react` — компонент и хуки                                  |
| `packages/vue`            | `@novaprose/vue` — компонент и композаблы                              |
| `packages/web-component`  | `@novaprose/web-component` — элемент `<novaprose-editor>` и CDN-сборка |
| `packages/angular`        | `@novaprose/angular` — компонент для ngModel и Reactive Forms          |
| `apps/playground`         | песочница для ручной проверки                                          |
| `packages/collab`         | `@novaprose/collab` — совместное редактирование                        |
| `packages/tinymce-compat` | `@novaprose/tinymce-compat` — перенос настроек `tinymce.init()`        |
| `apps/sync-server`        | сервер синхронизации (Docker)                                          |
| `apps/site`               | сайт novaprose.com                                                     |
| `docs/RELEASING.md`       | как выпускаются релизы                                                 |

## Лицензия

[MIT](LICENSE)
