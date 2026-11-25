/**
 * Сборка для подключения тегом <script> без сборщика: всё ядро + элемент, глобальный объект
 * `NovaProse`. Элемент <novaprose-editor> регистрируется сразу.
 */
import { defineNovaProseEditor } from './element';

export * from '@novaprose/core';
export { defineNovaProseEditor, getNovaProseEditorClass, DEFAULT_TAG } from './element';

defineNovaProseEditor();
