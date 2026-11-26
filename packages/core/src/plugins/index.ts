import { registerPlugin } from '../plugins';
import anchor from './anchor';
import comments from './comments';
import mentions from './mentions';
import mergetags from './mergetags';
import suggestions from './suggestions';
import media from './media';
import pagebreak from './pagebreak';

/**
 * Каталог встроенных плагинов NovaProse. Каждый подключается по имени (`plugins: ['insertdatetime']`)
 * и загружается лениво — отдельным чанком, не увеличивая ядро.
 */
registerPlugin('insertdatetime', () => import('./insertdatetime'));
registerPlugin('quickbars', () => import('./quickbars'));
registerPlugin('charmap', () => import('./charmap'));
registerPlugin('emoticons', () => import('./emoticons'));
registerPlugin('nonbreaking', () => import('./nonbreaking'));
registerPlugin('checklist', () => import('./checklist'));
registerPlugin('autolink', () => import('./autolink'));
registerPlugin('autosave', () => import('./autosave'));
registerPlugin('autoresize', () => import('./autoresize'));
registerPlugin('visualblocks', () => import('./visualblocks'));

// Плагины с узлами документа: схема нужна при создании редактора, поэтому они не ленивые.
registerPlugin('anchor', anchor);
registerPlugin('pagebreak', pagebreak);
registerPlugin('media', media);
registerPlugin('comments', comments);
registerPlugin('mentions', mentions);
registerPlugin('mergetags', mergetags);
registerPlugin('suggestions', suggestions);
registerPlugin('directionality', () => import('./directionality'));
registerPlugin('advlist', () => import('./advlist'));
registerPlugin('revisionhistory', () => import('./revisionhistory'));
