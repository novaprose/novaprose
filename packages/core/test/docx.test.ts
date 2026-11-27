import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions, type Editor } from '../src';
import { exportDocx, fromDocx, importDocx } from '../src/docx';
import { bookmarkName, hexColor, imageSize } from '../src/docx/export';
import { parseXml, textContent, type XmlElement } from '../src/docx/xml';
import { crc32, unzip, zip } from '../src/docx/zip';

/**
 * Word (.docx): ZIP and XML, export (valid XML, Word structure), import of Word-style documents
 * (styles, numbering, fields, merged cells, footnotes, revisions), the round trip.
 */

// Every editor a test makes is destroyed after it: one left alive keeps loading its lazy parts after
// the test file ends, and vitest reports that as errors after the environment was torn down.
const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(content: string, options: Record<string, unknown> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

/** Strict XML parsing by the browser: Word won't open a file with an XML error. */
function wellFormed(xml: string): void {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
}

const PNG = // 2×1 px
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8Dwn4EIwAgAJ/4D/c4Z6xcAAAAASUVORK5CYII=';

describe('ZIP and XML', () => {
  it('ZIP round trip: compressed and small (stored) files; CRC-32', async () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const big = new TextEncoder().encode('Hello, Word! '.repeat(200));
    const small = new TextEncoder().encode('tiny');
    const files = await unzip(
      await zip([
        { name: 'word/document.xml', data: big },
        { name: 'a.txt', data: small },
      ]),
    );
    expect(text(files.get('word/document.xml'))).toBe(text(big));
    expect(text(files.get('a.txt'))).toBe('tiny');
    await expect(unzip(new Uint8Array([1, 2, 3]))).rejects.toThrow('Not a ZIP');
  });

  it('XML: entities, CDATA, prefixed attributes, self-closing tags', () => {
    const root = parseXml(
      '<?xml version="1.0"?><!-- c --><w:p w:x="a &amp; b"><w:t>1 &lt; 2 &#x41;&#66;</w:t><w:br/><![CDATA[<raw>]]></w:p>',
    );
    const p = root.children[0] as XmlElement;
    expect(p.name).toBe('w:p');
    expect(p.attrs['w:x']).toBe('a & b');
    expect(textContent(p)).toBe('1 < 2 AB<raw>');
    expect((p.children[1] as XmlElement).name).toBe('w:br');
  });

  it('helpers: colors, bookmark names, image size', () => {
    expect(hexColor('#e03e2d')).toBe('E03E2D');
    expect(hexColor('#abc')).toBe('AABBCC');
    expect(hexColor('rgb(255, 0, 128)')).toBe('FF0080');
    expect(hexColor('rgba(0,0,0,0)')).toBeNull();
    expect(hexColor('var(--x)')).toBeNull();
    expect(bookmarkName('toc-ab12')).toBe('toc_ab12');
    expect(bookmarkName('1-intro')).toBe('b_1_intro');
    const png = Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0));
    expect(imageSize(png, 'png')).toEqual({ width: 2, height: 1 });
  });
});

const RICH =
  '<h1 id="intro">Report</h1>' +
  '<p style="text-align: center">Centered <strong>bold</strong> <em>it</em> <u>u</u> <s>s</s> ' +
  'H<sub>2</sub>O x<sup>2</sup> <span style="color: #e03e2d">red</span> ' +
  '<a href="https://example.com">site</a> <a href="#intro">back</a></p>' +
  '<p style="margin-left: 80px">Indented</p>' +
  '<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul>' +
  '<ol start="3"><li><p>three</p></li><li><p>four</p></li></ol>' +
  '<table><tbody>' +
  '<tr><th colspan="2"><p>Head</p></th></tr>' +
  '<tr><td rowspan="2" style="background-color: #fbeeb8;"><p>A</p></td><td><p>B</p></td></tr>' +
  '<tr><td><p>C</p></td></tr>' +
  '</tbody></table>' +
  `<p><img src="data:image/png;base64,${PNG}" alt="dot" width="20" height="10"></p>` +
  '<blockquote><p>Quote</p></blockquote>' +
  '<pre><code>line 1\nline 2</code></pre>' +
  '<hr><div class="nova-pagebreak" style="break-after: page;"></div><p>After</p>';

describe('export', () => {
  it('the parts of the file and valid XML; Word structure', async () => {
    const e = mount(RICH, { plugins: ['pagebreak'] });
    const files = await unzip(await exportDocx(e));
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/styles.xml',
      'word/numbering.xml',
      'word/_rels/document.xml.rels',
    ])
      wellFormed(text(files.get(part)));
    const doc = text(files.get('word/document.xml'));
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect(doc).toContain('<w:bookmarkStart w:id="1" w:name="intro"/>');
    expect(doc).toContain('<w:jc w:val="center"/>');
    expect(doc).toContain('<w:b/><w:bCs/>');
    expect(doc).toContain('<w:vertAlign w:val="subscript"/>');
    expect(doc).toContain('<w:color w:val="E03E2D"/>');
    expect(doc).toContain('<w:hyperlink w:anchor="intro">');
    expect(doc).toContain('<w:ind w:left="1200"/>');
    expect(doc).toMatch(/<w:numPr><w:ilvl w:val="1"\/><w:numId w:val="\d+"\/><\/w:numPr>/);
    expect(doc).toContain('<w:gridSpan w:val="2"/>');
    expect(doc).toContain('<w:vMerge w:val="restart"/>');
    expect(doc).toContain('<w:vMerge/>');
    expect(doc).toContain('w:fill="FBEEB8"');
    expect(doc).toContain('<w:tblHeader/>');
    expect(doc).toContain('<w:pStyle w:val="Quote"/>');
    expect(doc).toContain('<w:pStyle w:val="Code"/>');
    expect(doc).toContain('<w:br w:type="page"/>');
    // The image: a file in word/media and a relationship to it; the size comes from the attributes (px → EMU).
    expect(doc).toContain('<wp:extent cx="190500" cy="95250"/>');
    expect(files.has('word/media/image1.png')).toBe(true);
    const rels = text(files.get('word/_rels/document.xml.rels'));
    expect(rels).toContain('Target="media/image1.png"');
    expect(rels).toContain('Target="https://example.com" TargetMode="External"');
    const numbering = text(files.get('word/numbering.xml'));
    expect(numbering).toContain('<w:startOverride w:val="3"/>');
    expect(numbering).toContain('<w:numFmt w:val="bullet"/>');
    // The default sheet is A4 with 20 mm margins.
    expect(doc).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(doc).toContain('w:top="1134"');
  });

  it('the sheet from page mode; suggested edits become Word revisions', async () => {
    const e = mount(
      '<p>Keep <ins data-suggestion="s1" data-author="u1" data-name="Anna" data-time="1700000000000">new</ins>' +
        '<del data-suggestion="s2" data-author="u1" data-name="Anna" data-time="1700000000000">old</del></p>',
      {
        plugins: ['pagelayout', 'suggestions'],
        pluginOptions: { pagelayout: { size: 'A5', orientation: 'landscape', margins: 10 } },
      },
    );
    const doc = text((await unzip(await exportDocx(e))).get('word/document.xml'));
    expect(doc).toContain('<w:pgSz w:w="11906" w:h="8391" w:orient="landscape"/>');
    expect(doc).toContain('w:left="567"');
    expect(doc).toMatch(
      /<w:ins w:id="\d+" w:author="Anna" w:date="2023-11-14T22:13:20Z"><w:r><w:t xml:space="preserve">new<\/w:t><\/w:r><\/w:ins>/,
    );
    expect(doc).toContain('<w:delText xml:space="preserve">old</w:delText>');
  });

  it("an image that can't be loaded becomes a caption; a document without content is valid", async () => {
    const e = mount('<p><img src="https://example.invalid/x.png" alt="Logo"></p>');
    const bytes = await exportDocx(e, { loadImage: async () => null });
    expect(text((await unzip(bytes)).get('word/document.xml'))).toContain('[Logo]');
    e.setContent('');
    wellFormed(text((await unzip(await exportDocx(e))).get('word/document.xml')));
  });
});

describe('round trip', () => {
  it('export → import keeps the structure and formatting', async () => {
    const e = mount(RICH, { plugins: ['pagebreak'] });
    const result = await fromDocx(await exportDocx(e));
    const back = mount(result.html, { plugins: ['pagebreak'] });
    const html = back.getHTML();
    expect(html).toContain('<h1 id="intro">Report</h1>');
    expect(html).toContain('text-align: center');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>it</em>');
    expect(html).toContain('<u>u</u>');
    expect(html).toContain('<s>s</s>');
    expect(html).toContain('<sub>2</sub>');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('color: #e03e2d');
    expect(html).toContain('<a href="https://example.com">site</a>');
    expect(html).toContain('<a href="#intro">back</a>');
    expect(html).toContain('margin-left: 80px');
    expect(html).toContain(
      '<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li><li><p>two</p></li></ul>',
    );
    expect(html).toContain('<ol start="3"><li><p>three</p></li><li><p>four</p></li></ol>');
    expect(html).toMatch(/<th colspan="2"[^>]*><p>Head<\/p><\/th>/);
    expect(html).toMatch(/<td rowspan="2"[^>]*background-color: #fbeeb8;[^>]*><p>A<\/p><\/td>/);
    expect(html).toContain(`src="data:image/png;base64,${PNG}"`);
    expect(html).toContain('<blockquote><p>Quote</p></blockquote>');
    expect(html).toContain('line 1\nline 2');
    expect(html).toContain('<div class="nova-pagebreak" style="break-after: page;"></div>');
    expect(result.page).toMatchObject({ size: 'A4', orientation: 'portrait' });
  });
});

/** A .docx file from parts, the way Word writes them. */
async function docx(body: string, parts: Record<string, string> = {}): Promise<Uint8Array> {
  const enc = (s: string) => new TextEncoder().encode(s);
  const W =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const files: Record<string, string> = {
    '_rels/.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<w:document ${W}><w:body>${body}</w:body></w:document>`,
    'word/_rels/document.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' +
      '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org" TargetMode="External"/>' +
      '</Relationships>',
    'word/styles.xml':
      `<w:styles ${W}>` +
      // A localized Word shows a translated "Heading 1", but the built-in style name in the file is English.
      '<w:style w:type="paragraph" w:styleId="1"><w:name w:val="heading 1"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="MyTitle"><w:name w:val="My Title"/><w:basedOn w:val="1"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>' +
      '<w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/><w:rPr><w:b/></w:rPr></w:style>' +
      '</w:styles>',
    'word/numbering.xml':
      `<w:numbering ${W}>` +
      '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>' +
      '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
      '<w:num w:numId="2"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="4"/></w:lvlOverride></w:num>' +
      '</w:numbering>',
    'word/footnotes.xml': `<w:footnotes ${W}><w:footnote w:id="1"><w:p><w:r><w:t>A note.</w:t></w:r></w:p></w:footnote></w:footnotes>`,
    ...parts,
  };
  return zip(Object.entries(files).map(([name, data]) => ({ name, data: enc(data) })));
}

const run = (t: string, rPr = '') =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const para = (content: string, pPr = '') =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${content}</w:p>`;

describe('importing Word documents', () => {
  it('headings by style (inherited too), a bookmark becomes the id; a character style', async () => {
    const { html } = await fromDocx(
      await docx(
        para('<w:bookmarkStart w:id="0" w:name="_Toc1"/>' + run('Intro'), '<w:pStyle w:val="1"/>') +
          para(run('Sub'), '<w:pStyle w:val="MyTitle"/>') +
          para(run('strong', '<w:rStyle w:val="Strong"/>') + run(' plain')),
      ),
    );
    expect(html).toContain('<h1 id="_Toc1">Intro</h1>');
    expect(html).toContain('<h1>Sub</h1>');
    expect(html).toContain('<p><strong>strong</strong> plain</p>');
  });

  it('lists: numbering in a style, a lettered one with its own start; the HYPERLINK field; links', async () => {
    const { html } = await fromDocx(
      await docx(
        para(run('a'), '<w:pStyle w:val="ListBullet"/>') +
          para(run('b'), '<w:pStyle w:val="ListBullet"/>') +
          para(run('d'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>') +
          para(
            '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://novaprose.com" </w:instrText></w:r>' +
              '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
              run('field') +
              '<w:r><w:fldChar w:fldCharType="end"/></w:r> ' +
              '<w:hyperlink r:id="rId9">' +
              run('rel') +
              '</w:hyperlink>',
          ),
      ),
    );
    expect(html).toContain('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
    expect(html).toContain(
      '<ol start="4" style="list-style-type: lower-alpha"><li><p>d</p></li></ol>',
    );
    expect(html).toContain('<a href="https://novaprose.com">field</a>');
    expect(html).toContain('<a href="https://example.org">rel</a>');
    expect(html).not.toContain('HYPERLINK');
  });

  it('a table: gridSpan, vMerge, shading, a header row; column widths', async () => {
    const tc = (content: string, tcPr = '') =>
      `<w:tc>${tcPr ? `<w:tcPr>${tcPr}</w:tcPr>` : ''}${para(run(content))}</w:tc>`;
    const { html } = await fromDocx(
      await docx(
        '<w:tbl><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="3000"/></w:tblGrid>' +
          `<w:tr><w:trPr><w:tblHeader/></w:trPr>${tc('H', '<w:gridSpan w:val="2"/>')}</w:tr>` +
          `<w:tr>${tc('A', '<w:vMerge w:val="restart"/><w:shd w:val="clear" w:fill="FBEEB8"/>')}${tc('B')}</w:tr>` +
          `<w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc>${tc('C', '<w:vAlign w:val="center"/>')}</w:tr>` +
          '</w:tbl>',
      ),
    );
    expect(html).toContain('<th colspan="2" data-colwidth="100,200"><p>H</p></th>');
    expect(html).toContain(
      '<td rowspan="2" data-colwidth="100" style="background-color: #fbeeb8"><p>A</p></td>',
    );
    expect(html).toContain('<td data-colwidth="200" style="vertical-align: middle"><p>C</p></td>');
    expect(html.match(/<td/g)).toHaveLength(3);
  });

  it('revisions accepted, a footnote at the end, a page break, the sheet and margins', async () => {
    const result = await fromDocx(
      await docx(
        para(
          run('Keep ') +
            '<w:ins w:id="1" w:author="A"><w:r><w:t>added</w:t></w:r></w:ins>' +
            '<w:del w:id="2" w:author="A"><w:r><w:delText>gone</w:delText></w:r></w:del>' +
            '<w:r><w:footnoteReference w:id="1"/></w:r>' +
            '<w:r><w:br w:type="page"/></w:r>' +
            run('next'),
        ) +
          '<w:sectPr><w:pgSz w:w="8391" w:h="11906"/><w:pgMar w:top="567" w:right="850" w:bottom="567" w:left="850"/></w:sectPr>',
      ),
    );
    expect(result.html).toContain('<p>Keep added<sup>1</sup></p><div class="nova-pagebreak"');
    expect(result.html).toContain('<p>next</p>');
    expect(result.html).not.toContain('gone');
    expect(result.html).toContain('<hr><p><sup>1</sup> A note.</p>');
    expect(result.page).toEqual({
      size: 'A5',
      orientation: 'portrait',
      margins: { top: 10, right: 15, bottom: 10, left: 15 },
    });
  });

  it('importDocx replaces the content (Ctrl+Z brings it back), the sheet goes to page mode', async () => {
    const e = mount('<p>Before</p>', { plugins: ['pagelayout'] });
    await importDocx(
      e,
      await docx(
        para(run('Imported')) +
          '<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr>',
      ),
    );
    expect(e.getHTML()).toBe('<p>Imported</p>');
    expect(e.root.style.getPropertyValue('--nova-page-width')).toBe('297mm');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>Before</p>');
    await expect(
      fromDocx(new Uint8Array([80, 75, 5, 6, ...new Array(18).fill(0)])),
    ).rejects.toThrow('Not a Word document');
  });
});

describe('buttons in the editor', () => {
  it('exportword downloads a .docx; importword opens the chosen file', async () => {
    const e = mount('<p>Hello</p>', {
      plugins: ['exportword', 'importword'],
      pluginOptions: { exportword: { filename: 'report' } },
    });
    await e.ready;
    const urls: Blob[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => (urls.push(blob), 'blob:test'),
        revokeObjectURL: () => {},
      }),
    );
    let downloaded = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });
    const exportButton = e.ui.registry.get('exportword');
    if (exportButton?.type !== 'button') throw new Error('no exportword button');
    exportButton.onAction(e);
    await vi.waitFor(() => expect(downloaded).toBe('report.docx'));
    expect(urls[0]!.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    click.mockRestore();

    // Import: choosing a file in the hidden field replaces the content.
    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(urls[0]!);
    });
    e.setContent('<p>Other</p>');
    const importButton = e.ui.registry.get('importword');
    if (importButton?.type !== 'button') throw new Error('no importword button');
    const input = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      // In jsdom File has no arrayBuffer() (browsers have it).
      const file = Object.assign(new File([bytes as BlobPart], 'report.docx'), {
        arrayBuffer: async () => bytes.buffer,
      });
      Object.defineProperty(this, 'files', { value: [file] });
      this.dispatchEvent(new Event('change'));
    });
    importButton.onAction(e);
    await vi.waitFor(() => expect(e.getHTML()).toBe('<p>Hello</p>'));
    input.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('Word tracked changes as suggestions', () => {
  const ANN = 'w:author="Ann Lee" w:date="2026-11-20T10:00:00Z"';
  const when = Date.parse('2026-11-20T10:00:00Z');
  const tracked = para(
    run('Ship in ') +
      `<w:del w:id="3" ${ANN}><w:r><w:delText>May</w:delText></w:r></w:del>` +
      `<w:ins w:id="4" ${ANN}><w:r><w:t>June</w:t></w:r></w:ins>` +
      `<w:ins w:id="5" ${ANN}><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> now</w:t></w:r></w:ins>` +
      run('.'),
  );

  it('with revisions: suggestions, each with its author and date; one insertion over two runs is one', async () => {
    const { html } = await fromDocx(await docx(tracked), { revisions: 'suggestions' });
    const attrs = (id: string) =>
      ` data-suggestion="${id}" data-name="Ann Lee" data-time="${when}"`;
    expect(html).toBe(
      `<p>Ship in <del${attrs('w3')}>May</del><ins${attrs('w4')}>June</ins>` +
        `<ins${attrs('w4')}><strong> now</strong></ins>.</p>`,
    );
  });

  it('without: accepted, as before (the deleted text goes)', async () => {
    const { html } = await fromDocx(await docx(tracked));
    expect(html).toBe('<p>Ship in June<strong> now</strong>.</p>');
  });

  it('a move: the moved-from text is a deletion, the moved-to text an insertion', async () => {
    const { html } = await fromDocx(
      await docx(
        para(
          `<w:moveFrom w:id="8" ${ANN}><w:r><w:t>first</w:t></w:r></w:moveFrom>` + run(' then '),
        ) + para(`<w:moveTo w:id="9" ${ANN}><w:r><w:t>first</w:t></w:r></w:moveTo>`),
      ),
      { revisions: 'suggestions' },
    );
    expect(html).toMatch(/^<p><del data-suggestion="w8"[^>]*>first<\/del> then <\/p>/);
    expect(html).toMatch(/<p><ins data-suggestion="w9"[^>]*>first<\/ins><\/p>$/);
  });

  it('importDocx with the suggestions plugin keeps them, also in suggesting mode', async () => {
    const e = mount('<p>Before</p>', {
      plugins: ['suggestions'],
      pluginOptions: { suggestions: { enabled: true, author: { id: 'me', name: 'Me' } } },
    });
    await importDocx(e, await docx(tracked));
    expect(listSuggestions(e.view.state.doc).map((s) => [s.kind, s.text, s.author.name])).toEqual([
      ['delete', 'May', 'Ann Lee'],
      ['insert', 'June now', 'Ann Lee'],
    ]);
    expect(e.getText()).toBe('Ship in MayJune now.');
  });

  it('a formatting change: w:rPrChange becomes a suggested format that remembers the old look', async () => {
    const { html } = await fromDocx(
      await docx(
        para(
          `<w:r><w:rPr><w:b/><w:rPrChange w:id="6" ${ANN}><w:rPr><w:i/></w:rPr></w:rPrChange></w:rPr><w:t>now bold</w:t></w:r>`,
        ),
      ),
      { revisions: 'suggestions' },
    );
    expect(html).toBe(
      `<p><span data-suggestion="w6" data-name="Ann Lee" data-time="${when}" data-format="[{&quot;type&quot;:&quot;italic&quot;}]"><strong>now bold</strong></span></p>`,
    );
    const accepted = await fromDocx(
      await docx(
        para(
          `<w:r><w:rPr><w:b/><w:rPrChange w:id="6" ${ANN}><w:rPr/></w:rPrChange></w:rPr><w:t>x</w:t></w:r>`,
        ),
      ),
    );
    expect(accepted.html).toBe('<p><strong>x</strong></p>');
  });

  it('a suggested format goes to Word as w:rPrChange and comes back the same', async () => {
    const e = mount(
      '<p><strong><span data-suggestion="f1" data-format="[{&quot;type&quot;:&quot;italic&quot;}]" data-author="u1" data-name="Anna" data-time="1700000000000">bold</span></strong> rest</p>',
      { plugins: ['suggestions'] },
    );
    const bytes = await exportDocx(e);
    const xml = text((await unzip(bytes)).get('word/document.xml'));
    expect(xml).toMatch(
      /<w:rPr><w:b\/><w:bCs\/><w:rPrChange w:id="\d+" w:author="Anna" w:date="2023-11-14T22:13:20Z"><w:rPr><w:i\/><w:iCs\/><\/w:rPr><\/w:rPrChange><\/w:rPr>/,
    );
    wellFormed(xml);
    const back = mount('', { plugins: ['suggestions'] });
    await importDocx(back, bytes);
    expect(listSuggestions(back.view.state.doc)).toMatchObject([
      {
        kind: 'format',
        text: 'bold',
        added: ['bold'],
        removed: ['italic'],
        author: { name: 'Anna' },
        time: 1700000000000,
      },
    ]);
    back.view.dispatch(resolveSuggestions(back.view.state, 'reject'));
    expect(back.getHTML()).toBe('<p><em>bold</em> rest</p>');
  });

  it('round trip: suggestions → Word revisions → the same suggestions', async () => {
    const e = mount(
      '<p>Keep <ins data-suggestion="s1" data-author="u1" data-name="Anna" data-time="1700000000000">new</ins>' +
        ' and <del data-suggestion="s2" data-author="u2" data-name="Boris" data-time="1700000060000">old</del></p>',
      { plugins: ['suggestions'] },
    );
    const back = mount('', { plugins: ['suggestions'] });
    await importDocx(back, await exportDocx(e));
    expect(
      listSuggestions(back.view.state.doc).map((s) => [s.kind, s.text, s.author.name, s.time]),
    ).toEqual([
      ['insert', 'new', 'Anna', 1700000000000],
      ['delete', 'old', 'Boris', 1700000060000],
    ]);
  });
});
