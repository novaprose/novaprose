/**
 * Сборка для подключения тегом <script> без сборщика: всё ядро + элемент, глобальный объект
 * `NovaProse`. Элемент <novaprose-editor> регистрируется сразу.
 */
import { registerLanguage } from '@novaprose/core';
import ru from '@novaprose/core/i18n/ru';
import { defineNovaProseEditor } from './element';

// В npm-ядре языки — отдельные пакеты; CDN-сборка без сборщика, поэтому русский встроен заранее.
registerLanguage('ru', ru);

export * from '@novaprose/core';
export { defineNovaProseEditor, getNovaProseEditorClass, DEFAULT_TAG } from './element';

defineNovaProseEditor();
