// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closing, entries, strings } from '../src/migrate/js';
import { formatReport, migrate } from '../src/migrate/migrate';
import { cdnRange, dropInUrl, rewritePackage, rewriteSource } from '../src/migrate/rewrite';
import { scanFile } from '../src/migrate/scan';

/**
 * The migration of a TinyMCE project: a configuration read without running it, imports and script
 * tags rewritten, package.json moved to NovaProse, and the rest reported for a person.
 */

const VERSION = '0.10.0';
const DROP_IN =
  'https://cdn.jsdelivr.net/npm/@novaprose/tinymce-compat@0.10/dist/tinymce.global.js';

describe('reading JavaScript without running it', () => {
  it('finds the closing bracket past strings, templates, comments and regular expressions', () => {
    const src = `{ a: '}', b: "{", c: \`\${ {x: 1} }}\`, /* } */ d: /}/g, // }
      e: [1, (2)] }`;
    expect(closing(src, 0)).toBe(src.length - 1);
    expect(closing('{ unclosed', 0)).toBe(-1);
    expect(closing('{ ) }', 0)).toBe(-1);
  });

  it('lists top-level keys: plain, quoted, shorthand, methods and spreads', () => {
    const src = `{ plugins: 'a b', 'menubar': false, height, setup(editor) { editor.on('init', () => {}); }, ...base, async init_instance_callback() {} }`;
    const list = entries(src, 0, closing(src, 0));
    expect(list.map((entry) => entry.key)).toEqual([
      'plugins',
      'menubar',
      'height',
      'setup',
      null,
      'init_instance_callback',
    ]);
    expect(list[0]!.value).toBe("'a b'");
    expect(list[4]!.spread).toBe(true);
  });

  it('reads literal strings and arrays of them; anything computed is unknown', () => {
    expect(strings("'link lists'")).toEqual(['link lists']);
    expect(strings('\'link \' + "lists"')).toEqual(['link lists']);
    expect(strings('`code table`')).toEqual(['code table']);
    expect(strings("['advlist autolink', 'image']")).toEqual(['advlist autolink', 'image']);
    expect(strings('plugins')).toBeNull();
    expect(strings('`a ${b}`')).toBeNull();
    expect(strings("['a', ...more]")).toBeNull();
  });
});

describe('a file of a TinyMCE project', () => {
  it('tinymce.init() with an object, or with a variable of the same file', () => {
    const src = [
      "const config = { selector: '#a', plugins: ['link lists', 'tinycomments'], images_file_types: 'jpg' };",
      'tinymce.init(config);',
      "tinymce.init({ selector: '#b', plugins: 'code', toolbar: 'bold' });",
      'tinymce.init(settings);',
    ].join('\n');
    const { configs } = scanFile(src);
    expect(configs.map((c) => [c.line, c.keys, c.plugins, c.unread])).toEqual([
      [
        1,
        ['selector', 'plugins', 'images_file_types'],
        ['link', 'lists', 'tinycomments'],
        undefined,
      ],
      [3, ['selector', 'plugins', 'toolbar'], ['code'], undefined],
      [4, [], null, 'settings'],
    ]);
  });

  it('the React, Vue, Angular and web components with their props and init', () => {
    const react = scanFile(
      [
        "import { Editor as TinyEditor } from '@tinymce/tinymce-react';",
        'export const App = () => (',
        '  <TinyEditor apiKey="key" initialValue="<p>Hi</p>" onEditorChange={(html) => save(html)}',
        "    init={{ menubar: false, plugins: 'link', custom_thing: 1 }} />",
        ');',
      ].join('\n'),
    );
    expect(react.wrappers).toEqual([
      { line: 3, wrapper: 'react', props: ['apiKey', 'initialValue', 'onEditorChange', 'init'] },
    ]);
    expect(react.configs[0]).toMatchObject({
      from: 'react',
      keys: ['menubar', 'plugins', 'custom_thing'],
    });

    const vue = scanFile(
      [
        '<template>',
        '  <editor api-key="key" v-model="html" :init="{ plugins: \'lists\', toolbar: \'bold\' }" />',
        '</template>',
        '<script setup>',
        "import Editor from '@tinymce/tinymce-vue';",
        '</script>',
      ].join('\n'),
    );
    expect(vue.wrappers[0]).toMatchObject({
      wrapper: 'vue',
      props: ['api-key', 'v-model', ':init'],
    });
    expect(vue.configs[0]).toMatchObject({ from: 'vue', plugins: ['lists'] });

    const template =
      '<editor apiKey="key" [init]="{ plugins: \'table\' }" [(ngModel)]="html"></editor>';
    expect(scanFile(template).wrappers).toEqual([]);
    const angular = scanFile(template, { angular: true });
    expect(angular.wrappers[0]).toMatchObject({ wrapper: 'angular' });
    expect(angular.configs[0]).toMatchObject({ plugins: ['table'] });

    expect(
      scanFile('<tinymce-editor api-key="k" plugins="lists"></tinymce-editor>').wrappers,
    ).toEqual([{ line: 1, wrapper: 'webcomponent', props: ['api-key', 'plugins'] }]);
  });

  it('imports of the tinymce package: what each becomes', () => {
    const src = [
      "import tinymce from 'tinymce';",
      "import * as tiny from 'tinymce/tinymce';",
      "import type { Editor as TinyMCEEditor } from 'tinymce';",
      "import TinyMCE, { Editor } from 'tinymce';",
      "import { EditorEvent } from 'tinymce';",
      "import 'tinymce/themes/silver';",
      "import 'tinymce/plugins/link';",
      "import contentCss from 'tinymce/skins/content/default/content.css?inline';",
      "const t = require('tinymce');",
      "require('tinymce/icons/default');",
      "import 'tinymce';",
    ].join('\n');
    expect(scanFile(src).imports.map((i) => [i.line, i.replacement])).toEqual([
      [1, "import { tinymce } from '@novaprose/tinymce-compat';"],
      [2, "import { tinymce as tiny } from '@novaprose/tinymce-compat';"],
      [3, "import type { CompatEditor as TinyMCEEditor } from '@novaprose/tinymce-compat';"],
      [
        4,
        "import { tinymce as TinyMCE, CompatEditor as Editor } from '@novaprose/tinymce-compat';",
      ],
      [5, null],
      [6, ''],
      [7, ''],
      [8, null],
      [9, "const { tinymce: t } = require('@novaprose/tinymce-compat');"],
      [10, ''],
      [11, "import { tinymce } from '@novaprose/tinymce-compat';"],
    ]);
  });

  it('script tags: Tiny Cloud, a public CDN, a copy of your own', () => {
    const src = [
      '<script src="https://cdn.tiny.cloud/1/abc123/tinymce/7/tinymce.min.js" referrerpolicy="origin"></script>',
      "<script src='https://cdn.jsdelivr.net/npm/tinymce@6/tinymce.min.js'></script>",
      '<script type="text/javascript" src="/assets/tinymce/tinymce.min.js?v=3"></script>',
      '<script src="/js/app.js"></script>',
    ].join('\n');
    expect(scanFile(src).scripts.map((s) => [s.line, s.kind])).toEqual([
      [1, 'cloud'],
      [2, 'cdn'],
      [3, 'self-hosted'],
    ]);
  });
});

describe('the changes made without a person', () => {
  it('imports: the compatibility layer with its stylesheet once, the parts removed', () => {
    const src = [
      "import tinymce from 'tinymce';",
      "import 'tinymce/models/dom';",
      "import 'tinymce/plugins/link';",
      "import type { Editor } from 'tinymce';",
      '',
      "tinymce.init({ selector: 'textarea' });",
      '',
    ].join('\n');
    const rewritten = rewriteSource(src, scanFile(src), VERSION)!;
    expect(rewritten.output).toBe(
      [
        "import '@novaprose/core/style.css';",
        "import { tinymce } from '@novaprose/tinymce-compat';",
        "import type { CompatEditor as Editor } from '@novaprose/tinymce-compat';",
        '',
        "tinymce.init({ selector: 'textarea' });",
        '',
      ].join('\n'),
    );
    expect(rewritten.changes).toHaveLength(4);
    // A second run has nothing left to do.
    expect(rewriteSource(rewritten.output, scanFile(rewritten.output), VERSION)).toBeNull();
  });

  it('a file with Windows line ends keeps them', () => {
    const src =
      "import tinymce from 'tinymce';\r\nimport 'tinymce/plugins/link';\r\ntinymce.init({});\r\n";
    expect(rewriteSource(src, scanFile(src), VERSION)!.output).toBe(
      "import '@novaprose/core/style.css';\r\nimport { tinymce } from '@novaprose/tinymce-compat';\r\ntinymce.init({});\r\n",
    );
  });

  it('script tags load the drop-in; a copy of your own stays (it is reported)', () => {
    const src = [
      '<script src="https://cdn.tiny.cloud/1/abc123/tinymce/7/tinymce.min.js" referrerpolicy="origin"></script>',
      '<script src="/vendor/tinymce/tinymce.min.js"></script>',
    ].join('\n');
    const rewritten = rewriteSource(src, scanFile(src), VERSION)!;
    expect(rewritten.output).toBe(
      [
        `<script src="${DROP_IN}"></script>`,
        '<script src="/vendor/tinymce/tinymce.min.js"></script>',
      ].join('\n'),
    );
    expect(dropInUrl(VERSION)).toBe(DROP_IN);
    expect([cdnRange('0.10.3'), cdnRange('1.2.0'), cdnRange('2.0.0')]).toEqual(['0.10', '1', '2']);
  });

  it('package.json: NovaProse where tinymce was, the indentation kept', () => {
    const text =
      '{\n    "name": "app",\n    "dependencies": {\n        "react": "^19.0.0",\n        "tinymce": "^7.6.0",\n        "zod": "^3.0.0"\n    }\n}\n';
    const moved = rewritePackage(text, VERSION, false)!;
    expect(JSON.parse(moved.output).dependencies).toEqual({
      react: '^19.0.0',
      '@novaprose/tinymce-compat': '^0.10.0',
      '@novaprose/core': '^0.10.0',
      zod: '^3.0.0',
    });
    expect(Object.keys(JSON.parse(moved.output).dependencies)).toEqual([
      'react',
      '@novaprose/tinymce-compat',
      '@novaprose/core',
      'zod',
    ]);
    expect(moved.output).toMatch(/^\{\n {4}"name"/);
    expect(moved.output.endsWith('}\n')).toBe(true);
    // Something still needs tinymce: it stays next to NovaProse.
    expect(
      Object.keys(JSON.parse(rewritePackage(text, VERSION, true)!.output).dependencies),
    ).toEqual(['react', 'tinymce', '@novaprose/tinymce-compat', '@novaprose/core', 'zod']);
    expect(rewritePackage(moved.output, VERSION, false)).toBeNull();
    expect(rewritePackage('{"dependencies":{"react":"19"}}', VERSION, false)).toBeNull();
    expect(rewritePackage('not json', VERSION, false)).toBeNull();
  });
});

describe('a whole project', () => {
  let root = '';
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = '';
  });

  async function project(files: Record<string, string>): Promise<string> {
    root = await mkdtemp(join(tmpdir(), 'novaprose-migrate-'));
    for (const [path, text] of Object.entries(files)) {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), text);
    }
    return root;
  }

  const FILES = {
    'package.json': '{\n  "name": "site",\n  "dependencies": {\n    "tinymce": "^7.6.0"\n  }\n}\n',
    'index.html': [
      '<!doctype html>',
      '<script src="https://cdn.tiny.cloud/1/abc123/tinymce/7/tinymce.min.js" referrerpolicy="origin"></script>',
      '<textarea id="post"></textarea>',
      "<script>tinymce.init({ selector: '#post', plugins: 'link lists powerpaste nosuchplugin', spellchecker_rpc_url: '/rpc' });</script>",
      '',
    ].join('\n'),
    'src/editor.js': [
      "import tinymce from 'tinymce';",
      "import 'tinymce/icons/default';",
      "import 'tinymce/plugins/table';",
      '',
      "export const start = () => tinymce.init({ selector: '#a', plugins: 'table tinycomments' });",
      '',
    ].join('\n'),
    'src/notes.md': 'tinymce.init({}) in a note is not code',
    'node_modules/tinymce/tinymce.js': "tinymce.init({ selector: 'x' })",
    'public/tinymce/tinymce.min.js': '/* a copy */',
    'public/tinymce/plugins/link/plugin.min.js': '/* a plugin */',
  };

  it('a dry run changes nothing and says what it would do', async () => {
    const dir = await project(FILES);
    const result = await migrate({ root: dir, version: VERSION });
    expect(result.written).toBe(false);
    expect(await readFile(join(dir, 'src/editor.js'), 'utf8')).toBe(FILES['src/editor.js']);
    expect(result.files.map((file) => file.path)).toEqual([
      'index.html',
      'package.json',
      'src/editor.js',
    ]);
    expect(result.copies).toEqual(['public/tinymce']);
    expect(result.unknownOptions).toEqual(['spellchecker_rpc_url']);
    expect(result.missingPlugins).toEqual(['nosuchplugin']);
    const report = formatReport(result, false);
    expect(report).toContain('a dry run');
    expect(report).toContain('will change  line 2: <script src="https://cdn.tiny.cloud/');
    expect(report).toContain(
      'note     line 5: tinymce.init() — tinycomments is comments in NovaProse',
    );
    expect(report).toContain(
      "by hand  line 4: tinymce.init() — options NovaProse doesn't have yet: spellchecker_rpc_url",
    );
    expect(report).toContain(
      'dependencies: tinymce → @novaprose/tinymce-compat and @novaprose/core ^0.10.0',
    );
    expect(report).toContain('public/tinymce/\n  by hand  a copy of TinyMCE');
  });

  it('--write makes the changes, and a second run finds nothing more to change', async () => {
    const dir = await project(FILES);
    const result = await migrate({ root: dir, write: true, version: VERSION });
    expect(result.written).toBe(true);
    expect(await readFile(join(dir, 'src/editor.js'), 'utf8')).toBe(
      [
        "import '@novaprose/core/style.css';",
        "import { tinymce } from '@novaprose/tinymce-compat';",
        '',
        "export const start = () => tinymce.init({ selector: '#a', plugins: 'table tinycomments' });",
        '',
      ].join('\n'),
    );
    expect(await readFile(join(dir, 'index.html'), 'utf8')).toContain(
      `<script src="${DROP_IN}"></script>`,
    );
    expect(JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')).dependencies).toEqual({
      '@novaprose/tinymce-compat': '^0.10.0',
      '@novaprose/core': '^0.10.0',
    });
    // node_modules isn't touched.
    expect(await readFile(join(dir, 'node_modules/tinymce/tinymce.js'), 'utf8')).toBe(
      FILES['node_modules/tinymce/tinymce.js'],
    );
    const again = await migrate({ root: dir, write: true, version: VERSION });
    expect(again.files.flatMap((file) => file.changes)).toEqual([]);
  });

  it('a React project: the component is to move by hand, so tinymce stays in package.json', async () => {
    const dir = await project({
      'package.json':
        '{"dependencies":{"@tinymce/tinymce-react":"^6.0.0","tinymce":"^7.0.0","react":"^19.0.0"}}',
      'src/App.tsx': [
        "import { Editor } from '@tinymce/tinymce-react';",
        'export default () => <Editor tinymceScriptSrc="/tinymce/tinymce.min.js" init={{ plugins: \'lists\' }} />;',
      ].join('\n'),
    });
    const result = await migrate({ root: dir, write: true, version: VERSION });
    const app = result.files.find((file) => file.path === 'src/App.tsx')!;
    expect(app.manual[0]).toContain('<NovaProseEditor> of @novaprose/react');
    expect(
      Object.keys(JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')).dependencies),
    ).toEqual([
      '@tinymce/tinymce-react',
      'tinymce',
      '@novaprose/tinymce-compat',
      '@novaprose/core',
      'react',
    ]);
  });

  it('a project without TinyMCE', async () => {
    const dir = await project({ 'package.json': '{"name":"x"}', 'src/a.js': 'export {}' });
    const result = await migrate({ root: dir, version: VERSION });
    expect(formatReport(result, false)).toContain('No TinyMCE was found');
  });
});
