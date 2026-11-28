import tinymce from 'tinymce';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';
import 'tinymce/icons/default';
import 'tinymce/skins/ui/oxide/skin.js';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/link';

export function startEditor(selector) {
  return tinymce.init({
    selector,
    plugins: 'lists link',
    toolbar: 'bold italic | bullist | link',
  });
}
