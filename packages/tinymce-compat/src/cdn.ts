/**
 * The build for a <script> tag: sets window.tinymce and attaches the NovaProse styles (the file next to the
 * script), so that replacing `<script src="…/tinymce.min.js">` with this file works without other changes to the page.
 */
import { registerLanguage } from '@novaprose/core';
import { tinymce } from './index';

// Languages are separate parts next to the script: only the chosen one downloads. The element and tinymce.init
// wait for it themselves; before createEditor, await loadLanguage('de'). The list is every pack in core/src/i18n/packs.
registerLanguage('ru', () => import('@novaprose/core/i18n/ru'));
registerLanguage('de', () => import('@novaprose/core/i18n/de'));
registerLanguage('es', () => import('@novaprose/core/i18n/es'));
registerLanguage('fr', () => import('@novaprose/core/i18n/fr'));
registerLanguage('it', () => import('@novaprose/core/i18n/it'));
registerLanguage('pt-BR', () => import('@novaprose/core/i18n/pt-BR'));

declare global {
  interface Window {
    tinymce: typeof tinymce;
  }
}

const script = document.currentScript as HTMLScriptElement | null;
if (script?.src && !document.querySelector('link[data-novaprose-css]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = script.src.replace(/[^/]*$/, 'novaprose.css');
  link.setAttribute('data-novaprose-css', '');
  document.head.append(link);
}

window.tinymce = tinymce;

export { tinymce };
