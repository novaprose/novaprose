/**
 * Сборка для подключения тегом <script> без сборщика: всё ядро + элемент, глобальный объект
 * `NovaProse`. Элемент <novaprose-editor> регистрируется сразу.
 */
import { registerLanguage } from '@novaprose/core';
import { defineNovaProseEditor } from './element';

// Языки — отдельные части рядом со скриптом: качается только выбранный. Элемент и tinymce.init ждут
// его сами; перед createEditor — await loadLanguage('de'). Список — все пакеты core/src/i18n/packs.
registerLanguage('ru', () => import('@novaprose/core/i18n/ru'));
registerLanguage('de', () => import('@novaprose/core/i18n/de'));
registerLanguage('es', () => import('@novaprose/core/i18n/es'));
registerLanguage('fr', () => import('@novaprose/core/i18n/fr'));
registerLanguage('it', () => import('@novaprose/core/i18n/it'));
registerLanguage('pt-BR', () => import('@novaprose/core/i18n/pt-BR'));

export * from '@novaprose/core';
export { defineNovaProseEditor, getNovaProseEditorClass, DEFAULT_TAG } from './element';

defineNovaProseEditor();
