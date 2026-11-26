/**
 * The build for a <script> tag without a bundler: the whole core + the element, the global object
 * `NovaProse`. The <novaprose-editor> element is registered right away.
 */
import { registerLanguage } from '@novaprose/core';
import { defineNovaProseEditor } from './element';

// Languages are separate parts next to the script: only the chosen one downloads. The element and tinymce.init
// wait for it themselves; before createEditor, await loadLanguage('de'). The list is every pack in core/src/i18n/packs.
registerLanguage('ru', () => import('@novaprose/core/i18n/ru'));
registerLanguage('de', () => import('@novaprose/core/i18n/de'));
registerLanguage('es', () => import('@novaprose/core/i18n/es'));
registerLanguage('fr', () => import('@novaprose/core/i18n/fr'));
registerLanguage('it', () => import('@novaprose/core/i18n/it'));
registerLanguage('pt-BR', () => import('@novaprose/core/i18n/pt-BR'));

export * from '@novaprose/core';
export { defineNovaProseEditor, getNovaProseEditorClass, DEFAULT_TAG } from './element';

defineNovaProseEditor();
