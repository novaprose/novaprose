/**
 * Сборка для тега <script>: задаёт window.tinymce и подключает стили NovaProse (файл рядом со скриптом),
 * чтобы замена `<script src="…/tinymce.min.js">` на этот файл работала без других правок страницы.
 */
import { tinymce } from './index';

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
