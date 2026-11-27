import { registerPlugin } from '../plugins';
import accordion from './accordion';
import anchor from './anchor';
import math from './math';
import tableofcontents from './tableofcontents';
import comments from './comments';
import mentions from './mentions';
import mergetags from './mergetags';
import suggestions from './suggestions';
import media from './media';
import pagebreak from './pagebreak';
import pagelayout from './pagelayout';

/**
 * The catalog of built-in NovaProse plugins. Each one is attached by name (`plugins: ['insertdatetime']`)
 * and loads lazily, as a separate chunk, without growing the core.
 */
registerPlugin('insertdatetime', () => import('./insertdatetime'));
registerPlugin('casechange', () => import('./casechange'));
registerPlugin('formatpainter', () => import('./formatpainter'));
registerPlugin('permanentpen', () => import('./permanentpen'));
registerPlugin('visualchars', () => import('./visualchars'));
registerPlugin('save', () => import('./save'));
registerPlugin('markdown', () => import('./markdown'));
registerPlugin('importcss', () => import('./importcss'));
registerPlugin('template', () => import('./template'));
registerPlugin('quickbars', () => import('./quickbars'));
registerPlugin('charmap', () => import('./charmap'));
registerPlugin('emoticons', () => import('./emoticons'));
registerPlugin('nonbreaking', () => import('./nonbreaking'));
registerPlugin('checklist', () => import('./checklist'));
registerPlugin('codesample', () => import('./codesample'));
registerPlugin('draghandle', () => import('./draghandle'));
registerPlugin('autolink', () => import('./autolink'));
registerPlugin('autosave', () => import('./autosave'));
registerPlugin('autoresize', () => import('./autoresize'));
registerPlugin('visualblocks', () => import('./visualblocks'));
registerPlugin('exportword', () => import('./exportword'));
registerPlugin('exportpdf', () => import('./exportpdf'));
registerPlugin('importword', () => import('./importword'));
registerPlugin('ai', () => import('./ai'));

// Plugins with document nodes: the schema is needed when the editor is created, so they aren't lazy.
registerPlugin('anchor', anchor);
// Nodes right away, the interface and commands in the lazy part (NovaPlugin.load).
registerPlugin('accordion', accordion);
registerPlugin('tableofcontents', tableofcontents);
registerPlugin('math', math);
registerPlugin('pagebreak', pagebreak);
registerPlugin('pagelayout', pagelayout);
registerPlugin('media', media);
registerPlugin('comments', comments);
registerPlugin('mentions', mentions);
registerPlugin('mergetags', mergetags);
registerPlugin('suggestions', suggestions);
registerPlugin('directionality', () => import('./directionality'));
registerPlugin('advlist', () => import('./advlist'));
registerPlugin('revisionhistory', () => import('./revisionhistory'));
