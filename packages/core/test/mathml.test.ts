import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { mathmlToLatex } from '../src/plugins/mathml';

/** Formulas from other editors and sites: MathML read as LaTeX by the math plugin. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function latexOf(mathml: string): string {
  const template = document.createElement('template');
  template.innerHTML = mathml;
  return mathmlToLatex(template.content.querySelector('math')!);
}

describe('MathML to LaTeX', () => {
  it('takes the TeX source a formula carries (MathJax, KaTeX, Temml, Wikipedia)', () => {
    expect(
      latexOf(
        '<math alttext="{\\displaystyle E=mc^{2}}"><semantics><mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">{\\displaystyle E=mc^{2}}</annotation></semantics></math>',
      ),
    ).toBe('E=mc^{2}');
  });

  it('turns the common constructs into LaTeX', () => {
    const cases: [string, string][] = [
      ['<math><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math>', 'E = m c^2'],
      ['<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>', '\\frac{1}{2}'],
      [
        '<math><mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>c</mi></mfrac></math>',
        '\\frac{a + b}{c}',
      ],
      ['<math><msqrt><mi>x</mi></msqrt></math>', '\\sqrt{x}'],
      ['<math><mroot><mi>x</mi><mn>3</mn></mroot></math>', '\\sqrt[3]{x}'],
      ['<math><msub><mi>x</mi><mi>i</mi></msub></math>', 'x_i'],
      ['<math><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup></math>', 'x_i^2'],
      [
        '<math><mi>α</mi><mo>+</mo><mi>β</mi><mo>≤</mo><mi>π</mi></math>',
        '\\alpha + \\beta \\le \\pi',
      ],
      ['<math><mi>sin</mi><mo>\u2061</mo><mi>x</mi></math>', '\\sin x'],
      [
        '<math><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>a</mi><mi>i</mi></msub></math>',
        '\\sum_{i = 1}^n a_i',
      ],
      ['<math><mover><mi>v</mi><mo>→</mo></mover></math>', '\\vec{v}'],
      ['<math><mover><mi>x</mi><mo>¯</mo></mover></math>', '\\bar{x}'],
      ['<math><mfenced><mi>a</mi><mi>b</mi></mfenced></math>', '\\left( a, b \\right)'],
      [
        '<math><mtable><mtr><mtd><mn>1</mn></mtd><mtd><mn>0</mn></mtd></mtr><mtr><mtd><mn>0</mn></mtd><mtd><mn>1</mn></mtd></mtr></mtable></math>',
        '\\begin{matrix} 1 & 0 \\\\ 0 & 1 \\end{matrix}',
      ],
      ['<math><mtext>if </mtext><mi>x</mi><mo>&gt;</mo><mn>0</mn></math>', '\\text{if} x > 0'],
    ];
    for (const [mathml, latex] of cases) expect(latexOf(mathml), mathml).toBe(latex);
  });

  it('reads only text and structure: nothing of the markup gets through', () => {
    const latex = latexOf(
      '<math><mi onclick="alert(1)">x</mi><mtext>{\\href{javascript:alert(2)}{y}}</mtext><annotation-xml encoding="text/html"><img src=x onerror=alert(3)></annotation-xml></math>',
    );
    expect(latex).not.toMatch(/onclick|onerror|<|href\{/);
  });
});

describe('the math plugin reads MathML', () => {
  function make(content: string): Editor {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = createEditor({ element, content, plugins: ['math'] });
    editors.push(editor);
    return editor;
  }

  it('an inline <math> and a display one become formulas, kept as LaTeX', () => {
    const editor = make(
      '<p>Energy: <math><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math>.</p>' +
        '<math display="block"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>',
    );
    expect(editor.getHTML()).toBe(
      '<p>Energy: <span data-type="inline-math" data-latex="E = m c^2">\\(E = m c^2\\)</span>.</p>' +
        '<div data-type="block-math" data-latex="\\frac{1}{2}">\\[\\frac{1}{2}\\]</div>',
    );
    // Its own HTML reads back the same.
    expect(make(editor.getHTML()).getHTML()).toBe(editor.getHTML());
  });

  it('without the plugin, a formula stays its text, as before', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = createEditor({
      element,
      content: '<p>E = <math><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math></p>',
    });
    editors.push(editor);
    expect(editor.getHTML()).toBe('<p>E = mc2</p>');
  });
});

describe('formulas pasted from pages', () => {
  function make(content: string): Editor {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = createEditor({ element, content, plugins: ['math'] });
    editors.push(editor);
    return editor;
  }

  it('KaTeX: the formula once, without its drawn copy', () => {
    const editor = make(
      '<p>Area: <span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>π</mi><msup><mi>r</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">\\pi r^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="mord mathnormal">πr</span><span class="msupsub">2</span></span></span></span> cm²</p>',
    );
    expect(editor.getHTML()).toBe(
      '<p>Area: <span data-type="inline-math" data-latex="\\pi r^2">\\(\\pi r^2\\)</span> cm²</p>',
    );
  });

  it('Wikipedia: the formula from its TeX, without the fallback image', () => {
    const editor = make(
      '<p>Mass–energy: <span class="mwe-math-element"><span class="mwe-math-mathml-inline mwe-math-mathml-a11y" style="display: none;"><math alttext="{\\displaystyle E=mc^{2}}"><semantics><mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">{\\displaystyle E=mc^{2}}</annotation></semantics></math></span><img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/abc" class="mwe-math-fallback-image-inline" alt="{\\displaystyle E=mc^{2}}"></span>.</p>',
    );
    expect(editor.getHTML()).toBe(
      '<p>Mass–energy: <span data-type="inline-math" data-latex="E=mc^{2}">\\(E=mc^{2}\\)</span>.</p>',
    );
  });
});
