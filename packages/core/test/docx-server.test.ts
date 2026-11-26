// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { exportDocx, fromDocx } from '../src/docx';
import { unzip } from '../src/docx/zip';

/** Word на сервере: сохранённый JSON → .docx и .docx → HTML без DOM. */

describe('Word на сервере, без DOM', () => {
  it('JSON → .docx → HTML', async () => {
    expect(typeof document).toBe('undefined');
    const json = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Invoice' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'mention', attrs: { id: 'u1', name: 'Anna' } },
            { type: 'text', text: ' & ', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    const bytes = await exportDocx(json, {
      plugins: ['mentions'],
      page: { size: 'A5' },
      title: 'Invoice <1>',
    });
    const files = await unzip(bytes);
    expect(new TextDecoder().decode(files.get('docProps/core.xml'))).toContain(
      '<dc:title>Invoice &lt;1&gt;</dc:title>',
    );
    expect(new TextDecoder().decode(files.get('word/document.xml'))).toContain(
      '<w:pgSz w:w="8391" w:h="11906"/>',
    );
    const { html, page } = await fromDocx(bytes);
    expect(html).toBe('<h2>Invoice</h2><p>Hello @Anna<strong> &amp; </strong></p>');
    expect(page).toMatchObject({ size: 'A5' });
  });
});
