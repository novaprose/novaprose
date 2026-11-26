/**
 * Сборка для тега <script>: задаёт window.tinymce и подключает стили NovaProse (файл рядом со скриптом),
 * чтобы замена `<script src="…/tinymce.min.js">` на этот файл работала без других правок страницы.
 */
import { registerLanguage } from '@novaprose/core';
import ru from '@novaprose/core/i18n/ru';
import { tinymce } from './index';

// В npm-ядре языки — отдельные пакеты; CDN-сборка без сборщика, поэтому русский встроен заранее.
registerLanguage('ru', ru);

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
