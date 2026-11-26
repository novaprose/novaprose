import { readFile } from 'node:fs/promises';
import { createRenderer } from '@novaprose/core';

// A document saved from the editor with editor.getJSON() — from your database in a real app.
const saved = JSON.parse(await readFile(new URL('./document.json', import.meta.url), 'utf8'));

// The same options as the editor (only the ones that shape the HTML matter).
const renderer = createRenderer({ plugins: ['mentions', 'math'] });

console.log('HTML (as editor.getHTML()):\n');
console.log(renderer.html(saved));
console.log('\nText (search index, plain-text email):\n');
console.log(renderer.text(saved));
