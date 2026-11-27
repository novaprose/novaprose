import { afterEach, describe, expect, it } from 'vitest';
import { checkAccessibility, contrastRatio, parseColor, type A11yCheckOptions } from '../src/a11y';
import { createEditor, type Editor } from '../src';

/** The accessibility rules (WCAG 2.1) on documents parsed by the editor's schema. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function check(html: string, options: A11yCheckOptions = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content: html, plugins: ['anchor'] });
  editors.push(editor);
  return checkAccessibility(editor.view.state.doc, options);
}

const rules = (html: string, options: A11yCheckOptions = {}) =>
  check(html, options).map((issue) => issue.rule);

const IMG = 'https://example.com/photos/cat.png';

describe('images', () => {
  it('I2: no alternative text; blank text counts as none', () => {
    expect(rules(`<p><img src="${IMG}"></p>`)).toEqual(['I2']);
    expect(rules(`<p><img src="${IMG}" alt="  "></p>`)).toEqual(['I2']);
    expect(check(`<p><img src="${IMG}"></p>`)[0]).toMatchObject({
      severity: 'error',
      level: 'A',
      text: 'cat.png',
    });
  });

  it('I1: a decorative image (alt="") is fine unless decorative images are not allowed', () => {
    expect(rules(`<p><img src="${IMG}" alt=""></p>`)).toEqual([]);
    expect(rules(`<p><img src="${IMG}" alt=""></p>`, { allowDecorativeImages: false })).toEqual([
      'I1',
    ]);
  });

  it('I3: a file name for alternative text; I4: too long', () => {
    expect(rules(`<p><img src="${IMG}" alt="cat.png"></p>`)).toEqual(['I3']);
    expect(rules(`<p><img src="${IMG}" alt="IMG_1234"></p>`)).toEqual(['I3']);
    expect(rules(`<p><img src="${IMG}" alt="${'A long description. '.repeat(10)}"></p>`)).toEqual([
      'I4',
    ]);
    expect(rules(`<p><img src="${IMG}" alt="A grey cat on a sofa"></p>`)).toEqual([]);
  });
});

describe('headings and structure', () => {
  it('D2: a skipped level, with the level to change to; the first heading may be any level', () => {
    const issues = check('<h2>A</h2><p>x</p><h4>B</h4>');
    expect(issues.map((i) => [i.rule, i.text, i.data])).toEqual([['D2', 'B', { level: 4, to: 3 }]]);
    expect(rules('<h3>Start</h3><h4>Next</h4>')).toEqual([]);
  });

  it('N2: an empty heading (one with an image is not empty)', () => {
    expect(rules('<h2></h2><p>x</p>')).toEqual(['N2']);
    expect(rules(`<h2><img src="${IMG}" alt="Logo"></h2>`)).toEqual([]);
  });

  it('D1: a short bold paragraph looks like a heading; a sentence does not', () => {
    const issues = check('<h2>Intro</h2><p><strong>Details</strong></p><p>Text.</p>');
    expect(issues.map((i) => [i.rule, i.data])).toEqual([['D1', { level: 3 }]]);
    expect(rules('<p><strong>This is important.</strong></p>')).toEqual([]);
    expect(rules('<p><strong>Bold</strong> and plain</p>')).toEqual([]);
  });

  it('D4U and D4O: lists typed by hand; one numbered paragraph is not a list', () => {
    expect(rules('<p>• one</p><p>• two</p><p>after</p>')).toEqual(['D4U']);
    expect(rules('<p>1. one</p><p>2. two</p>')).toEqual(['D4O']);
    expect(rules('<p>1. Introduction</p><p>Some text.</p>')).toEqual([]);
    const [issue] = check('<p>- a</p><p>- b</p>');
    expect(issue).toMatchObject({ rule: 'D4U', text: '- a - b' });
  });

  it('H93: the same id twice', () => {
    expect(check('<h2 id="a">One</h2><h2 id="a">Two</h2>').map((i) => [i.rule, i.text])).toEqual([
      ['H93', '#a'],
    ]);
  });

  it('T4B: a table without header cells', () => {
    const body = '<tr><td><p>a</p></td></tr><tr><td><p>b</p></td></tr>';
    expect(rules(`<table><tbody>${body}</tbody></table>`)).toEqual(['T4B']);
    expect(rules(`<table><tbody><tr><th><p>h</p></th></tr>${body}</tbody></table>`)).toEqual([]);
  });
});

describe('links', () => {
  it('D3: two links next to each other to the same address', () => {
    expect(
      rules('<p><a href="https://a.example">Report</a> <a href="https://a.example">PDF</a></p>'),
    ).toEqual(['D3']);
    expect(
      rules('<p><a href="https://a.example">One</a> and <a href="https://a.example">two</a></p>'),
    ).toEqual([]);
  });

  it('N1: link text that says nothing; N3: a link without text', () => {
    expect(rules('<p>See <a href="https://a.example">click here</a>.</p>')).toEqual(['N1']);
    expect(rules('<p><a href="https://a.example">Read more!</a></p>')).toEqual(['N1']);
    expect(rules(`<p><a href="https://a.example"><img src="${IMG}" alt=""></a></p>`)).toEqual([
      'N3',
    ]);
    expect(rules(`<p><a href="https://a.example"><img src="${IMG}" alt="Home"></a></p>`)).toEqual(
      [],
    );
  });
});

describe('contrast', () => {
  it('WCAG ratios', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio(parseColor('#767676')!, [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(parseColor('red')).toEqual([255, 0, 0]);
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toBeNull();
    expect(parseColor('transparent')).toBeNull();
  });

  it('D5B for normal text, D5A for large text; enough contrast is fine', () => {
    const [issue] = check('<p><span style="color: #aaaaaa">light grey</span> text</p>');
    expect(issue).toMatchObject({
      rule: 'D5B',
      level: 'AA',
      text: 'light grey',
      data: { rule: 'D5B', ratio: 2.32, required: 4.5 },
    });
    expect(rules('<h1><span style="color: #949494">Big</span></h1>')).toEqual([]);
    expect(rules('<h1><span style="color: #aaaaaa">Big</span></h1>')).toEqual(['D5A']);
    expect(rules('<p><span style="color: #595959">dark grey</span></p>')).toEqual([]);
  });

  it('text on a highlight; AAA asks for 7:1', () => {
    expect(
      rules(
        '<p><span style="background-color: #000080"><span style="color: #0000ff">x</span></span></p>',
      ),
    ).toEqual(['D5B']);
    expect(rules('<p><span style="color: #767676">grey</span></p>')).toEqual([]);
    expect(rules('<p><span style="color: #767676">grey</span></p>', { level: 'aaa' })).toEqual([
      'D5C',
    ]);
  });
});

describe('options', () => {
  it('level A leaves out AA rules; ignoredRules leaves out rules by id', () => {
    const html = `<h2></h2><p><span style="color: #aaaaaa">x</span></p><p><img src="${IMG}"></p>`;
    expect(rules(html)).toEqual(['N2', 'D5B', 'I2']);
    expect(rules(html, { level: 'a' })).toEqual(['I2']);
    expect(rules(html, { ignoredRules: ['I2', 'N2'] })).toEqual(['D5B']);
  });

  it('a clean document has no issues', () => {
    expect(
      rules(
        `<h1>Title</h1><p>Text with <a href="https://a.example">the annual report</a>.</p>` +
          `<h2>Part</h2><ul><li><p>one</p></li></ul><p><img src="${IMG}" alt="A cat"></p>`,
      ),
    ).toEqual([]);
  });
});
