/**
 * MathML read as LaTeX, for formulas that come from other editors and sites. The TeX source an
 * element carries (`<annotation encoding="application/x-tex">`, as MathJax, KaTeX, Temml and
 * Wikipedia write it) is taken as it is; otherwise the common constructs are turned into LaTeX:
 * letters and numbers, operators, fractions, roots, sub- and superscripts, accents, limits,
 * brackets, matrices. Only the formula's text and structure are read, never its markup.
 */

const GREEK: Record<string, string> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  ϵ: 'epsilon',
  ζ: 'zeta',
  η: 'eta',
  θ: 'theta',
  ϑ: 'vartheta',
  ι: 'iota',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  ν: 'nu',
  ξ: 'xi',
  π: 'pi',
  ϖ: 'varpi',
  ρ: 'rho',
  ϱ: 'varrho',
  σ: 'sigma',
  ς: 'varsigma',
  τ: 'tau',
  υ: 'upsilon',
  φ: 'phi',
  ϕ: 'phi',
  χ: 'chi',
  ψ: 'psi',
  ω: 'omega',
  Γ: 'Gamma',
  Δ: 'Delta',
  Θ: 'Theta',
  Λ: 'Lambda',
  Ξ: 'Xi',
  Π: 'Pi',
  Σ: 'Sigma',
  Υ: 'Upsilon',
  Φ: 'Phi',
  Ψ: 'Psi',
  Ω: 'Omega',
};

const SYMBOLS: Record<string, string> = {
  '×': '\\times',
  '÷': '\\div',
  '±': '\\pm',
  '∓': '\\mp',
  '⋅': '\\cdot',
  '·': '\\cdot',
  '∗': '\\ast',
  '−': '-',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '≈': '\\approx',
  '≡': '\\equiv',
  '∼': '\\sim',
  '≅': '\\cong',
  '∝': '\\propto',
  '∞': '\\infty',
  '∂': '\\partial',
  '∇': '\\nabla',
  '∑': '\\sum',
  '∏': '\\prod',
  '∫': '\\int',
  '∬': '\\iint',
  '∮': '\\oint',
  '√': '\\surd',
  '∈': '\\in',
  '∉': '\\notin',
  '∋': '\\ni',
  '⊂': '\\subset',
  '⊃': '\\supset',
  '⊆': '\\subseteq',
  '⊇': '\\supseteq',
  '∪': '\\cup',
  '∩': '\\cap',
  '∅': '\\emptyset',
  '∀': '\\forall',
  '∃': '\\exists',
  '¬': '\\neg',
  '∧': '\\wedge',
  '∨': '\\vee',
  '→': '\\to',
  '←': '\\leftarrow',
  '↔': '\\leftrightarrow',
  '⇒': '\\Rightarrow',
  '⇐': '\\Leftarrow',
  '⇔': '\\Leftrightarrow',
  '↦': '\\mapsto',
  '…': '\\ldots',
  '⋯': '\\cdots',
  '⋮': '\\vdots',
  '⋱': '\\ddots',
  '°': '^\\circ',
  '′': "'",
  '″': "''",
  '∠': '\\angle',
  '⊥': '\\perp',
  '∥': '\\parallel',
  '⊕': '\\oplus',
  '⊗': '\\otimes',
  '∘': '\\circ',
  '⟨': '\\langle',
  '⟩': '\\rangle',
  '⌊': '\\lfloor',
  '⌋': '\\rfloor',
  '⌈': '\\lceil',
  '⌉': '\\rceil',
  '{': '\\{',
  '}': '\\}',
  '|': '|',
  '‖': '\\|',
  '%': '\\%',
  '#': '\\#',
  '&': '\\&',
  _: '\\_',
  $: '\\$',
  ℝ: '\\mathbb{R}',
  ℕ: '\\mathbb{N}',
  ℤ: '\\mathbb{Z}',
  ℚ: '\\mathbb{Q}',
  ℂ: '\\mathbb{C}',
  ℏ: '\\hbar',
  ℓ: '\\ell',
  '\u2061': '',
  '\u2062': '',
  '\u2063': '',
  '\u2064': '',
};

/** Accents written over a base (mover with accent): the command for each. */
const ACCENTS: Record<string, string> = {
  '^': 'hat',
  ˆ: 'hat',
  '\u0302': 'hat',
  '¯': 'bar',
  '‾': 'overline',
  '\u0304': 'bar',
  '→': 'vec',
  '\u20d7': 'vec',
  '~': 'tilde',
  '˜': 'tilde',
  '\u0303': 'tilde',
  '˙': 'dot',
  '\u0307': 'dot',
  '¨': 'ddot',
  '\u0308': 'ddot',
  '⏞': 'overbrace',
  '⌢': 'overarc',
};

/** Functions written in upright letters (`sin` in an <mi>). */
const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'exp',
  'lim',
  'max',
  'min',
  'sup',
  'inf',
  'det',
  'dim',
  'ker',
  'gcd',
  'deg',
  'arg',
  'Pr',
]);

/** Large operators that take limits below and above (∑ with munderover). */
const LIMITS = /^\\(sum|prod|int|iint|oint|lim|max|min|sup|inf|bigcup|bigcap)$/;

function symbols(text: string): string {
  let out = '';
  for (const char of text) {
    if (GREEK[char]) out += `\\${GREEK[char]} `;
    else if (char in SYMBOLS)
      out += SYMBOLS[char]!.startsWith('\\') ? `${SYMBOLS[char]} ` : SYMBOLS[char];
    else out += char;
  }
  return out.replace(/ +$/, '').replace(/ (?=[^A-Za-z])/g, '');
}

/** A command's argument: always in braces (\\vec v would read as the command \\vecv). */
function arg(latex: string): string {
  return `{${latex.trim()}}`;
}

/** A sub- or superscript, or its base: braces unless it is one character or command. */
function group(latex: string): string {
  const trimmed = latex.trim();
  return /^([A-Za-z0-9]|\\[A-Za-z]+)$/.test(trimmed) ? trimmed : `{${trimmed}}`;
}

function texAnnotation(math: Element): string | null {
  for (const annotation of math.getElementsByTagName('annotation')) {
    const encoding = (annotation.getAttribute('encoding') ?? '').toLowerCase();
    if (encoding === 'application/x-tex' || encoding === 'tex' || encoding === 'latex') {
      const tex = annotation.textContent?.trim();
      if (tex) return tex.replace(/^\{\\displaystyle\s*(.*)\}$/s, '$1').trim();
    }
  }
  return null;
}

function convert(el: Element): string {
  const children = [...el.children];
  const all = () => children.map(convert).join(' ').replace(/\s+/g, ' ').trim();
  const text = (el.textContent ?? '').trim();
  switch (el.localName) {
    case 'mi': {
      if (text.length > 1 && FUNCTIONS.has(text)) return `\\${text}`;
      if (text.length > 1 && !/[^\p{L}]/u.test(text)) return `\\mathrm{${text}}`;
      return symbols(text);
    }
    case 'mn':
      return text;
    case 'mo':
      return symbols(text);
    case 'mtext':
      return text ? `\\text{${text.replace(/[{}\\]/g, '')}}` : '';
    case 'ms':
      return `\\text{"${text.replace(/[{}\\]/g, '')}"}`;
    case 'mspace':
      return '\\,';
    case 'msup':
      return `${group(convert(children[0] ?? el))}^${group(children[1] ? convert(children[1]) : '')}`;
    case 'msub':
      return `${group(convert(children[0] ?? el))}_${group(children[1] ? convert(children[1]) : '')}`;
    case 'msubsup':
      return `${group(children[0] ? convert(children[0]) : '')}_${group(children[1] ? convert(children[1]) : '')}^${group(children[2] ? convert(children[2]) : '')}`;
    case 'mfrac':
      return `\\frac${arg(children[0] ? convert(children[0]) : '')}${arg(children[1] ? convert(children[1]) : '')}`;
    case 'msqrt':
      return `\\sqrt{${all()}}`;
    case 'mroot':
      return `\\sqrt[${children[1] ? convert(children[1]) : ''}]{${children[0] ? convert(children[0]) : ''}}`;
    case 'mover': {
      const base = children[0] ? convert(children[0]) : '';
      const over = (children[1]?.textContent ?? '').trim();
      if (ACCENTS[over]) return `\\${ACCENTS[over]}${arg(base)}`;
      if (LIMITS.test(base)) return `${base}^${group(children[1] ? convert(children[1]) : '')}`;
      return `\\overset${arg(children[1] ? convert(children[1]) : '')}${arg(base)}`;
    }
    case 'munder': {
      const base = children[0] ? convert(children[0]) : '';
      const under = children[1] ? convert(children[1]) : '';
      if (LIMITS.test(base)) return `${base}_${group(under)}`;
      if ((children[1]?.textContent ?? '').trim() === '_') return `\\underline${arg(base)}`;
      return `\\underset${arg(under)}${arg(base)}`;
    }
    case 'munderover': {
      const base = children[0] ? convert(children[0]) : '';
      return `${base}_${group(children[1] ? convert(children[1]) : '')}^${group(children[2] ? convert(children[2]) : '')}`;
    }
    case 'mfenced': {
      const open = el.getAttribute('open') ?? '(';
      const close = el.getAttribute('close') ?? ')';
      const separator = (el.getAttribute('separators') ?? ',').trim()[0] ?? ',';
      const bracket = (b: string) => (b === '{' ? '\\{' : b === '}' ? '\\}' : b || '.');
      return `\\left${bracket(open)} ${children.map(convert).join(`${separator} `)} \\right${bracket(close)}`;
    }
    case 'mtable': {
      const rows = children
        .filter((row) => row.localName === 'mtr' || row.localName === 'mlabeledtr')
        .map((row) =>
          [...row.children]
            .filter((cell) => cell.localName === 'mtd')
            .map(convert)
            .join(' & '),
        );
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }
    case 'mtd':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'mphantom':
    case 'menclose':
    case 'merror':
    case 'math':
      return all();
    case 'semantics':
      return children[0] ? convert(children[0]) : '';
    case 'annotation':
    case 'annotation-xml':
    case 'mprescripts':
    case 'none':
      return '';
    default:
      return children.length ? all() : symbols(text);
  }
}

/** The LaTeX of a <math> element (its TeX annotation when it has one), at most 10,000 characters. */
export function mathmlToLatex(math: Element): string {
  const tex = texAnnotation(math);
  const latex = tex ?? convert(math);
  return latex
    .replace(/\s+/g, ' ')
    .replace(/\s*([_^])\s*/g, '$1')
    .trim()
    .slice(0, 10_000);
}

/** Whether a <math> element is a formula on its own line. */
export function isDisplayMath(math: Element): boolean {
  return math.getAttribute('display') === 'block' || math.getAttribute('mode') === 'display';
}
