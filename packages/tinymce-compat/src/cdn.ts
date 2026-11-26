/**
 * Сборка для тега <script>: задаёт window.tinymce и подключает стили NovaProse (файл рядом со скриптом),
 * чтобы замена `<script src="…/tinymce.min.js">` на этот файл работала без других правок страницы.
 */
import { registerLanguage } from '@novaprose/core';
import { tinymce } from './index';

// Языки — отдельные части рядом со скриптом: качается только выбранный. Элемент и tinymce.init ждут
// его сами; перед createEditor — await loadLanguage('de'). Список — все пакеты core/src/i18n/packs.
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
