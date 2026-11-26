/**
 * A large document for the measurements: deterministic (the same in every run) and close to a
 * real one: headings, paragraphs with bold, italic and links, lists, tables. A "page" is
 * about 500 words, like an A4 sheet in a regular font.
 */

const WORDS = (
  'the editor keeps every change in a document model so typing stays fast even when a long ' +
  'report with tables lists and links grows to hundreds of pages written by many people at once ' +
  'quality matters more than features and every release is tested in real browsers before it ships'
).split(' ');

export function bigDocument(pages: number): string {
  let seed = 42;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const word = () => WORDS[Math.floor(random() * WORDS.length)]!;
  const sentence = () => {
    const words = Array.from({ length: 8 + Math.floor(random() * 10) }, word);
    words[0] = words[0]![0]!.toUpperCase() + words[0]!.slice(1);
    return `${words.join(' ')}.`;
  };
  const paragraph = (index: number) =>
    `<p>${sentence()} <strong>${sentence()}</strong> ${sentence()} ` +
    `<a href="https://example.com/${index}">${word()} ${word()}</a> <em>${sentence()}</em> ` +
    `${sentence()}</p>`;
  const out: string[] = [];
  for (let page = 0; page < pages; page++) {
    out.push(`<h2>Section ${page + 1}</h2>`);
    for (let i = 0; i < 5; i++) out.push(paragraph(page * 10 + i));
    out.push(`<ul>${[1, 2, 3].map(() => `<li><p>${sentence()}</p></li>`).join('')}</ul>`);
    if (page % 10 === 5) {
      const row = (cell: string) => `<tr>${Array.from({ length: 4 }, () => cell).join('')}</tr>`;
      out.push(
        `<table><tbody>${row(`<th><p>${word()}</p></th>`)}` +
          `${Array.from({ length: 6 }, () => row(`<td><p>${word()} ${word()}</p></td>`)).join('')}` +
          `</tbody></table>`,
      );
    }
  }
  return out.join('');
}

/** HTML the way Word puts it on the clipboard: mso styles, conditional comments, MsoNormal classes. */
export function wordClipboard(paragraphs: number): string {
  const body = Array.from(
    { length: paragraphs },
    (_, i) =>
      `<p class=MsoNormal style='margin-bottom:0cm;line-height:normal;mso-pagination:none'>` +
      `<span lang=EN-US style='font-size:12.0pt;font-family:"Calibri",sans-serif;mso-ansi-language:EN-US'>` +
      `Paragraph ${i + 1} pasted from Word with <b>bold</b> and <i>italic</i> text` +
      `<o:p></o:p></span></p>`,
  ).join('\n');
  return (
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0cm;} --></style>` +
    `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]--></head>` +
    `<body lang=EN-US><!--StartFragment-->${body}<!--EndFragment--></body></html>`
  );
}
