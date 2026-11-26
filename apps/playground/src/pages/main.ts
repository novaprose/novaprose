import '@novaprose/core/style.css';
import { createEditor, pageLayout, printContent, type PageSizeName } from '@novaprose/core';
import '../playground.css';

/**
 * Режим страниц (плагин pagelayout): лист A5 с полями 15 мм, границы страниц, печать тем же
 * листом. Её гоняет e2e/pages.spec.ts (window.pagesDemo — для проверок).
 */

const words =
  'Page layout shows the document the way it will be printed: the same sheet, the same margins ' +
  'and the same line breaks, so the lines that mark where each page ends are where the printer ' +
  'will start a new sheet. ';
const paragraph = (n: number) => `<p>${n}. ${words.repeat(2)}</p>`;
const rows = Array.from(
  { length: 6 },
  (_, i) => `<tr><td><p>Row ${i + 1}</p></td><td><p>${words.slice(0, 60)}</p></td></tr>`,
).join('');

const content = [
  '<h1>Pages and printing</h1>',
  ...Array.from({ length: 6 }, (_, i) => paragraph(i + 1)),
  `<table><tbody>${rows}</tbody></table>`,
  ...Array.from({ length: 4 }, (_, i) => paragraph(i + 7)),
  '<div class="nova-pagebreak" style="break-after: page;"></div>',
  '<h2>After a page break</h2>',
  ...Array.from({ length: 3 }, (_, i) => paragraph(i + 11)),
].join('');

const editor = createEditor({
  element: document.querySelector<HTMLElement>('#editor')!,
  content,
  plugins: ['pagelayout', 'pagebreak'],
  pluginOptions: { pagelayout: { size: 'A5', margins: 15 } },
  menubar: true,
});
const controller = pageLayout(editor)!;
const count = document.querySelector('#count')!;
const show = () => (count.textContent = `Pages: ${controller.pages ?? '—'}`);
controller.onChange(show);
show();

const field = <T extends HTMLElement>(id: string) => document.querySelector<T>(id)!;
field<HTMLSelectElement>('#size').addEventListener('change', (event) =>
  controller.set({ size: (event.target as HTMLSelectElement).value as PageSizeName }),
);
field<HTMLSelectElement>('#orientation').addEventListener('change', (event) =>
  controller.set({
    orientation: (event.target as HTMLSelectElement).value as 'portrait' | 'landscape',
  }),
);
field<HTMLInputElement>('#margins').addEventListener('change', (event) =>
  controller.set({ margins: Number((event.target as HTMLInputElement).value) }),
);
field('#print').addEventListener('click', () => printContent(editor));

declare global {
  interface Window {
    pagesDemo: { editor: typeof editor; controller: typeof controller };
  }
}
window.pagesDemo = { editor, controller };
