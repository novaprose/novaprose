import { a as e, c as t, o as n, r } from './style.jq9nI6HT.js';
import { t as i } from './chunk-NPKAIW34.BN8oA196.js';
import { n as a } from './chunk-HPLT3XRZ.CB2AI2JC.js';
import { c as o, r as s, t as c } from './dist.DtV7jSsK.js';
var l = new Set([
    `lists`,
    `link`,
    `image`,
    `table`,
    `code`,
    `codesample`,
    `preview`,
    `searchreplace`,
    `fullscreen`,
    `help`,
    `wordcount`,
    `paste`,
    `hr`,
    `print`,
    `textcolor`,
    `colorpicker`,
    `contextmenu`,
    `tabfocus`,
    `textpattern`,
    `imagetools`,
    `powerpaste`,
    `importcss`,
    `accordion`,
  ]),
  u = { tinycomments: `comments` },
  d = new Set(
    `selector.target.license_key.api_key.branding.promotion.skin.skin_url.content_css.icons.icons_url.theme.theme_url.base_url.suffix.referrer_policy.convert_urls.relative_urls.remove_script_host.document_base_url.entity_encoding.height.min_height.max_height.width.resize.content_style.setup.init_instance_callback.inline.plugins.toolbar.menubar.statusbar.placeholder.readonly.disabled.block_formats.file_picker_callback.formats.style_formats.style_formats_merge.valid_classes.table_class_list.table_cell_class_list.file_picker_types.language.images_upload_handler.paste_as_text.paste_preprocess.paste_postprocess.invalid_elements.valid_elements.valid_styles.toolbar_mode.toolbar_sticky.font_family_formats.font_size_formats.line_height_formats.color_map.autosave_interval.autosave_retention.autosave_prefix.quickbars_selection_toolbar.quickbars_insert_toolbar.mentions_fetch.tinycomments_author.tinycomments_author_name`.split(
      `.`,
    ),
  ),
  f = (e) => (Array.isArray(e) ? e.join(` `) : String(e ?? ``)).split(/[\s,]+/).filter(Boolean);
function p(e) {
  if (typeof e == `string`)
    return e
      .split(`;`)
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => {
        let [t, n] = e.includes(`=`) ? e.split(`=`) : [e, e];
        return { label: t.trim(), value: (n ?? t).trim() };
      });
}
function m(e) {
  let t = ``,
    n = new Promise((n) => {
      let r = new FileReader();
      ((r.onload = () => {
        ((t = String(r.result).replace(/^data:[^,]*,/, ``)), n());
      }),
        (r.onerror = () => n()),
        r.readAsDataURL(e));
    }),
    r = ``;
  return {
    ready: n,
    info: {
      id: () => e.name.replace(/\.[^.]+$/, ``) || `image`,
      name: () => e.name.replace(/\.[^.]+$/, ``) || `image`,
      filename: () => e.name || `image`,
      blob: () => e,
      base64: () => t,
      blobUri: () => (r ||= URL.createObjectURL(e)),
      uri: () => void 0,
    },
  };
}
var h = new Set([`p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `blockquote`, `pre`]),
  g = new Set([`span`, `strong`, `b`, `em`, `i`, `u`, `s`, `strike`, `del`, `code`, `sub`, `sup`]);
function _(e) {
  let t = Array.isArray(e) ? e : [e],
    n = [];
  for (let e of t) {
    if (!e || typeof e != `object`) continue;
    let t = e,
      r = {};
    (typeof t.block == `string` &&
      h.has(t.block.toLowerCase()) &&
      (r.block = t.block.toLowerCase()),
      typeof t.inline == `string` &&
        g.has(t.inline.toLowerCase()) &&
        (r.inline = t.inline.toLowerCase()),
      typeof t.selector == `string` && (r.selector = t.selector),
      (typeof t.classes == `string` || Array.isArray(t.classes)) && (r.classes = t.classes),
      t.styles &&
        typeof t.styles == `object` &&
        (r.styles = Object.fromEntries(
          Object.entries(t.styles)
            .filter(([, e]) => typeof e == `string` && !e.includes(`%`))
            .map(([e, t]) => [e.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`), t]),
        )),
      (r.block || r.inline || r.selector) && n.push(r));
  }
  return n;
}
function v(e) {
  return Array.isArray(e)
    ? e.flatMap((e) => {
        if (!e || typeof e != `object`) return [];
        let t = e,
          n = String(t.title ?? ``);
        if (!n) return [];
        if (Array.isArray(t.items)) return [{ title: n, items: v(t.items) }];
        if (typeof t.format == `string`) return [{ title: n, format: t.format }];
        let [r] = _(t);
        return r ? [{ title: n, ...r }] : [];
      })
    : [];
}
function y(e) {
  let t = Object.keys(e).filter((e) => !d.has(e)),
    n = [],
    r = [];
  for (let t of f(e.plugins)) {
    let e = u[t] ?? t;
    l.has(t) || (a(e) ? n.push(e) : r.push(t));
  }
  let i = { plugins: n };
  (e.toolbar === !1
    ? (i.toolbar = !1)
    : Array.isArray(e.toolbar)
      ? (i.toolbar = e.toolbar.join(` | `))
      : typeof e.toolbar == `string` && (i.toolbar = e.toolbar),
    e.menubar !== void 0 && (i.menubar = e.menubar),
    typeof e.statusbar == `boolean` && (i.statusbar = e.statusbar),
    typeof e.placeholder == `string` && (i.placeholder = e.placeholder),
    e.readonly === !0 && (i.editable = !1),
    typeof e.content_style == `string` && (i.contentStyle = e.content_style));
  let o = (e) =>
      Array.isArray(e)
        ? e
            .filter((e) => !!e && typeof e.title == `string` && typeof e.value == `string`)
            .map(({ title: e, value: t }) => ({ title: e, value: t }))
        : void 0,
    s = o(e.table_class_list);
  s && (i.tableClassList = s);
  let c = o(e.table_cell_class_list);
  if (
    (c && (i.tableCellClassList = c),
    e.formats &&
      typeof e.formats == `object` &&
      (i.formats = Object.fromEntries(
        Object.entries(e.formats)
          .map(([e, t]) => [e, _(t)])
          .filter(([, e]) => e.length),
      )),
    Array.isArray(e.style_formats) &&
      ((i.styleFormats = v(e.style_formats)),
      e.style_formats_merge === !0 && (i.styleFormatsMerge = !0)),
    (i.validClasses =
      typeof e.valid_classes == `string`
        ? f(e.valid_classes)
        : e.valid_classes && typeof e.valid_classes == `object`
          ? Object.values(e.valid_classes).flatMap((e) => f(e))
          : !0),
    e.content_css !== void 0 && e.content_css !== !1)
  ) {
    let t = new Set([`default`, `dark`, `document`, `writer`, `tinymce-5`, `tinymce-5-dark`]),
      n = (Array.isArray(e.content_css) ? e.content_css : String(e.content_css).split(`,`))
        .map((e) => String(e).trim())
        .filter((e) => e && !t.has(e));
    n.length && (i.contentCss = n);
  }
  (e.disabled === !0 && (i.disabled = !0),
    e.resize !== !1 && (i.resize = e.resize !== `both` || `both`));
  let h = p(e.block_formats);
  if (h) {
    let e = [`p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `pre`];
    i.blockFormats = h
      .map(({ label: e, value: t }) => ({ label: e, block: t.toLowerCase() }))
      .filter((t) => e.includes(t.block));
  }
  if (
    (typeof e.language == `string` && (i.language = e.language.replace(`_`, `-`)),
    e.toolbar_mode === `sliding` || e.toolbar_mode === `wrap`
      ? (i.toolbarMode = e.toolbar_mode)
      : (e.toolbar_mode === `floating` || e.toolbar_mode === `scrolling`) &&
        (i.toolbarMode = `sliding`),
    e.inline === !0 && (i.mode = `inline`),
    e.paste_as_text === !0 && (i.pasteAsText = !0),
    typeof e.paste_preprocess == `function`)
  ) {
    let t = e.paste_preprocess;
    i.pastePreprocess = (e, n) => {
      let r = { content: e };
      return (t(n, r), r.content);
    };
  }
  (typeof e.invalid_elements == `string` && (i.invalidElements = e.invalid_elements),
    typeof e.valid_elements == `string` && (i.validElements = e.valid_elements),
    e.valid_styles && (i.validStyles = e.valid_styles));
  let g = p(e.font_family_formats);
  g && (i.fontFamilies = g);
  let y = p(e.font_size_formats);
  y && (i.fontSizes = y.map((e) => e.value));
  let b = p(e.line_height_formats);
  if (
    (b && (i.lineHeights = b.map((e) => e.value)),
    Array.isArray(e.color_map) &&
      (i.colors = e.color_map
        .filter((e, t) => t % 2 == 0)
        .map((e) => (e.startsWith(`#`) ? e : `#${e}`))),
    typeof e.images_upload_handler == `function`)
  ) {
    let t = e.images_upload_handler;
    i.uploadImage = async (e, n) => {
      let { ready: r, info: i } = m(e);
      return (await r, t(i, n));
    };
  }
  if (typeof e.file_picker_callback == `function`) {
    let t = e.file_picker_callback;
    (typeof e.file_picker_types == `string` &&
      (i.filePickerTypes = f(e.file_picker_types).filter(
        (e) => e === `file` || e === `image` || e === `media`,
      )),
      (i.filePicker = ({ type: e, value: n }) =>
        new Promise((r) =>
          t((e, t = {}) => r({ url: e, ...t }), n, { filetype: e, fieldname: `src` }),
        )));
  }
  let x = {};
  if (e.autosave_interval || e.autosave_retention || e.autosave_prefix) {
    let t = (e) => parseInt(String(e), 10);
    x.autosave = {
      ...(e.autosave_interval ? { delay: t(e.autosave_interval) * 1e3 } : {}),
      ...(e.autosave_retention ? { retention: t(e.autosave_retention) } : {}),
      ...(e.autosave_prefix ? { key: String(e.autosave_prefix) } : {}),
    };
  }
  if (
    ((e.quickbars_selection_toolbar !== void 0 || e.quickbars_insert_toolbar !== void 0) &&
      (x.quickbars = {
        ...(e.quickbars_selection_toolbar === void 0
          ? {}
          : { selection: e.quickbars_selection_toolbar }),
        ...(e.quickbars_insert_toolbar === void 0 ? {} : { insert: e.quickbars_insert_toolbar }),
      }),
    typeof e.mentions_fetch == `function`)
  ) {
    let t = e.mentions_fetch;
    x.mentions = { fetch: (e) => new Promise((n) => t({ term: e }, n)) };
  }
  return (
    e.tinycomments_author &&
      (x.comments = {
        author: {
          id: String(e.tinycomments_author),
          name: String(e.tinycomments_author_name ?? e.tinycomments_author),
        },
      }),
    Object.keys(x).length && (i.pluginOptions = x),
    { options: i, unknown: t, missingPlugins: r }
  );
}
var b = 0,
  x = () => `nova-compat-field-${++b}`;
function S(e, t, n) {
  let r = document.createElement(e);
  return (t && (r.className = t), n !== void 0 && (r.textContent = n), r);
}
function ee(e) {
  let t = document.createElement(`template`);
  return (
    (t.innerHTML = e),
    t.content
      .querySelectorAll(`script, style, iframe, object, embed, link, meta, base, form`)
      .forEach((e) => e.remove()),
    t.content.querySelectorAll(`*`).forEach((e) => {
      for (let t of [...e.attributes]) {
        let n = t.value.trim().toLowerCase();
        (t.name.startsWith(`on`) || /^(javascript|vbscript|data):/.test(n)) &&
          e.removeAttribute(t.name);
      }
    }),
    t.content
  );
}
function C(e, t, n) {
  let r = new Map(),
    i = new Map(),
    a = ``,
    o = !1,
    s = null,
    c = (e) => t.onChange?.(h, { name: e });
  function l(e, t) {
    let n = x();
    t.id = n;
    let r = S(`div`, `nova-field`);
    if (e.label) {
      let t = S(`label`, `nova-label`, e.label);
      ((t.htmlFor = n), r.append(t));
    }
    return (r.append(t), r);
  }
  function u(e) {
    let n = e.name ?? ``,
      i = e.enabled !== !1 && e.disabled !== !0;
    switch (e.type) {
      case `input`:
      case `urlinput`:
      case `colorinput`: {
        let t = S(`input`, `nova-input`);
        return (
          (t.type = e.type === `colorinput` ? `color` : e.type === `urlinput` ? `url` : `text`),
          e.inputMode && (t.inputMode = e.inputMode),
          e.placeholder && (t.placeholder = e.placeholder),
          (t.disabled = !i),
          t.addEventListener(`input`, () => c(n)),
          n &&
            r.set(n, {
              get: () => (e.type === `urlinput` ? { value: t.value } : t.value),
              set: (n) => {
                t.value = String(
                  e.type === `urlinput` && n && typeof n == `object` ? (n.value ?? ``) : (n ?? ``),
                );
              },
              focus: () => t.focus(),
              setEnabled: (e) => (t.disabled = !e),
            }),
          l(e, t)
        );
      }
      case `textarea`: {
        let t = S(`textarea`, `nova-input`);
        return (
          (t.rows = e.maximized ? 10 : 4),
          e.placeholder && (t.placeholder = e.placeholder),
          (t.disabled = !i),
          t.addEventListener(`input`, () => c(n)),
          n &&
            r.set(n, {
              get: () => t.value,
              set: (e) => (t.value = String(e ?? ``)),
              focus: () => t.focus(),
              setEnabled: (e) => (t.disabled = !e),
            }),
          l(e, t)
        );
      }
      case `checkbox`: {
        let t = S(`input`, `nova-checkbox`);
        ((t.type = `checkbox`),
          (t.id = x()),
          (t.disabled = !i),
          t.addEventListener(`change`, () => c(n)));
        let a = S(`label`, void 0, e.label ?? ``);
        ((a.htmlFor = t.id),
          n &&
            r.set(n, {
              get: () => t.checked,
              set: (e) => (t.checked = !!e),
              focus: () => t.focus(),
              setEnabled: (e) => (t.disabled = !e),
            }));
        let o = S(`div`, `nova-field nova-field-inline`);
        return (o.append(t, a), o);
      }
      case `selectbox`:
      case `listbox`: {
        let t = S(`select`, `nova-input nova-select`);
        for (let n of e.items ?? []) {
          let e = S(`option`, void 0, n.text);
          ((e.value = n.value), t.append(e));
        }
        return (
          (t.disabled = !i),
          t.addEventListener(`change`, () => c(n)),
          n &&
            r.set(n, {
              get: () => t.value,
              set: (e) => (t.value = String(e ?? ``)),
              focus: () => t.focus(),
              setEnabled: (e) => (t.disabled = !e),
            }),
          l(e, t)
        );
      }
      case `button`: {
        let a = S(
          `button`,
          e.primary || e.buttonType === `primary`
            ? `nova-button nova-button-primary`
            : `nova-button`,
          e.text ?? ``,
        );
        return (
          (a.type = `button`),
          (a.disabled = !i),
          a.addEventListener(`click`, () => t.onAction?.(h, { name: n })),
          n &&
            r.set(n, {
              get: () => void 0,
              set: () => {},
              focus: () => a.focus(),
              setEnabled: (e) => (a.disabled = !e),
            }),
          a
        );
      }
      case `htmlpanel`: {
        let t = S(`div`, `nova-compat-html`);
        return (t.append(ee(e.html ?? ``)), t);
      }
      case `alertbanner`: {
        let t = S(`p`, `nova-compat-alert is-${e.level ?? `info`}`, e.text ?? ``);
        return (t.setAttribute(`role`, e.level === `error` ? `alert` : `status`), t);
      }
      case `label`: {
        let t = S(`div`, `nova-compat-group`);
        t.append(S(`p`, `nova-label`, e.label ?? ``));
        for (let n of e.items ?? []) {
          let e = u(n);
          e && t.append(e);
        }
        return t;
      }
      case `grid`:
      case `bar`: {
        let t = S(`div`, `nova-compat-grid`),
          n =
            e.type === `bar` ? (e.items?.length ?? 1) : e.columns === `auto` ? 2 : (e.columns ?? 2);
        t.style.gridTemplateColumns = `repeat(${Number(n) || 2}, minmax(0, 1fr))`;
        for (let n of e.items ?? []) {
          let e = u(n);
          e && t.append(e);
        }
        return t;
      }
      default:
        return (
          console.warn(`[nova] tinymce-compat: dialog component "${e.type}" is not supported yet`),
          null
        );
    }
  }
  let d = S(`div`, `nova-compat-dialog nova-form`);
  if (t.body.type === `tabpanel`) {
    let e = S(`div`, `nova-compat-tabs`);
    (e.setAttribute(`role`, `tablist`),
      d.append(e),
      t.body.tabs.forEach((t, n) => {
        let r = t.name ?? t.title,
          o = S(`button`, `nova-compat-tab`, t.title);
        ((o.type = `button`), o.setAttribute(`role`, `tab`));
        let s = S(`div`, `nova-compat-tabpanel`);
        s.setAttribute(`role`, `tabpanel`);
        for (let e of t.items) {
          let t = u(e);
          t && s.append(t);
        }
        (o.addEventListener(`click`, () => h.showTab(r)),
          i.set(r, { button: o, panel: s }),
          e.append(o),
          d.append(s),
          n === 0 && (a = r));
      }));
  } else
    for (let e of t.body.items) {
      let t = u(e);
      t && d.append(t);
    }
  let f = t.buttons ?? [],
    p = f.find((e) => e.type === `submit`),
    m = f.filter((e) => e.type === `custom`);
  if (m.length) {
    let e = S(`div`, `nova-compat-actions`);
    for (let n of m) {
      let i = S(`button`, n.primary ? `nova-button nova-button-primary` : `nova-button`, n.text);
      ((i.type = `button`),
        (i.disabled = n.enabled === !1),
        i.addEventListener(`click`, () => t.onAction?.(h, { name: n.name ?? n.text })),
        n.name &&
          r.set(n.name, {
            get: () => void 0,
            set: () => {},
            focus: () => i.focus(),
            setEnabled: (e) => (i.disabled = !e),
          }),
        e.append(i));
    }
    d.append(e);
  }
  let h = {
    getData: () => {
      let e = {};
      return (
        r.forEach((t, n) => {
          let r = t.get();
          r !== void 0 && (e[n] = r);
        }),
        e
      );
    },
    setData: (e) => {
      for (let [t, n] of Object.entries(e)) r.get(t)?.set(n);
    },
    close: () => {
      ((o = !0), s?.close());
    },
    block: () => s?.setBusy(!0),
    unblock: () => s?.setBusy(!1),
    focus: (e) => r.get(e)?.focus(),
    disable: (e) => r.get(e)?.setEnabled(!1),
    enable: (e) => r.get(e)?.setEnabled(!0),
    showTab: (e) => {
      if (!i.has(e)) return;
      let n = a;
      ((a = e),
        i.forEach(({ button: t, panel: n }, r) => {
          let i = r === e;
          (t.setAttribute(`aria-selected`, String(i)), (t.tabIndex = i ? 0 : -1), (n.hidden = !i));
        }),
        n && n !== e && t.onTabChange?.(h, { newTabName: e, oldTabName: n }));
    },
    redial: (e) => {
      (h.close(), Object.assign(h, n(e)));
    },
  };
  return (
    t.initialData && h.setData(t.initialData),
    a && h.showTab(a),
    (s = e.ui.openDialog({
      title: t.title,
      body: d,
      ...(p ? { submitLabel: p.text } : {}),
      ...(t.size === `large` ? { size: `large` } : {}),
      onSubmit: () => (t.onSubmit?.(h), o),
      onClose: () => {
        (o || t.onCancel?.(h), t.onClose?.());
      },
    })),
    h
  );
}
var w = new r(),
  T = {
    bold: `bold`,
    italic: `italic`,
    underline: `underline`,
    strikethrough: `strike`,
    superscript: `superscript`,
    subscript: `subscript`,
    justifyleft: `alignLeft`,
    justifycenter: `alignCenter`,
    justifyright: `alignRight`,
    justifyfull: `alignJustify`,
    insertunorderedlist: `bulletList`,
    insertorderedlist: `orderedList`,
    indent: `indent`,
    outdent: `outdent`,
    undo: `undo`,
    redo: `redo`,
    removeformat: `clearFormatting`,
    unlink: `unlink`,
    inserthorizontalrule: `horizontalRule`,
    mceblockquote: `blockquote`,
  },
  E = {
    p: `paragraph`,
    h1: `h1`,
    h2: `h2`,
    h3: `h3`,
    h4: `h4`,
    h5: `h5`,
    h6: `h6`,
    blockquote: `blockquote`,
    pre: `codeBlock`,
  },
  D = {
    bold: `bold`,
    italic: `italic`,
    underline: `underline`,
    'strike-through': `strike`,
    link: `link`,
    unlink: `unlink`,
    image: `image`,
    table: `table`,
    undo: `undo`,
    redo: `redo`,
    'align-left': `alignLeft`,
    'align-center': `alignCenter`,
    'align-right': `alignRight`,
    'align-justify': `alignJustify`,
    'unordered-list': `bulletList`,
    'ordered-list': `orderedList`,
    indent: `indent`,
    outdent: `outdent`,
    quote: `blockquote`,
    'code-sample': `codeBlock`,
    'horizontal-rule': `horizontalRule`,
    'remove-formatting': `clearFormatting`,
    fullscreen: `fullscreen`,
    preview: `preview`,
    sourcecode: `sourceCode`,
    help: `help`,
    print: `print`,
    search: `search`,
    copy: `copy`,
    'edit-block': `edit`,
    checkmark: `check`,
    close: `close`,
    upload: `upload`,
    subscript: `subscript`,
    superscript: `superscript`,
    'paste-text': `pasteText`,
    'text-color': `textColor`,
    'highlight-bg-color': `highlight`,
    'line-height': `lineHeight`,
  },
  O = {
    bold: `bold`,
    italic: `italic`,
    underline: `underline`,
    strikethrough: `strike`,
    superscript: `superscript`,
    subscript: `subscript`,
    code: `code`,
    p: `paragraph`,
    h1: `h1`,
    h2: `h2`,
    h3: `h3`,
    h4: `h4`,
    h5: `h5`,
    h6: `h6`,
    blockquote: `blockquote`,
    pre: `codeBlock`,
    alignleft: `alignLeft`,
    aligncenter: `alignCenter`,
    alignright: `alignRight`,
    alignjustify: `alignJustify`,
  },
  k = new Set([`p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `blockquote`, `pre`]),
  A = new Set([
    `p`,
    `h1`,
    `h2`,
    `h3`,
    `h4`,
    `h5`,
    `h6`,
    `blockquote`,
    `pre`,
    `alignleft`,
    `aligncenter`,
    `alignright`,
    `alignjustify`,
  ]),
  j = {
    forecolor: `color`,
    hilitecolor: `background`,
    fontname: `font_family`,
    fontsize: `font_size`,
  };
function M(e) {
  console.warn(
    `[nova] tinymce-compat: editor.dom.${e} changes the editor DOM directly, which NovaProse redraws from its document model. Use setContent, insertContent or editor.formatter instead.`,
  );
}
var N = new Map();
function P(e) {
  if (typeof e != `string` || !e) return;
  if (N.has(e)) return N.get(e);
  let t = D[e] ?? (e in i ? e : void 0);
  return t ? i[t] : void 0;
}
function F(e) {
  let t = !1,
    n = !0;
  return {
    state: {
      get active() {
        return t;
      },
      get enabled() {
        return n;
      },
    },
    api: {
      isActive: () => t,
      setActive: (n) => {
        ((t = n), e.core.updateUI());
      },
      isEnabled: () => n,
      setEnabled: (t) => {
        ((n = t), e.core.updateUI());
      },
      isDisabled: () => !n,
      setDisabled: (t) => {
        ((n = !t), e.core.updateUI());
      },
    },
  };
}
var I = class {
    id;
    core;
    targetElm;
    settings;
    initialized = !1;
    removed = !1;
    handlers = new Map();
    dirty = !1;
    teardowns = [];
    constructor(e, t, n, r) {
      ((this.core = e), (this.targetElm = t), (this.id = n), (this.settings = r));
    }
    getContent(e = {}) {
      let t = { format: e.format ?? `html`, content: `` };
      return (
        (t.content = t.format === `text` ? this.core.getText() : this.core.getHTML()),
        this.fire(`GetContent`, t),
        t.content
      );
    }
    setContent(e, t = {}) {
      let n = { content: e, ...t };
      return (
        this.fire(`BeforeSetContent`, n),
        this.core.setContent(n.content),
        this.fire(`SetContent`, n),
        n.content
      );
    }
    insertContent(e) {
      this.core.insertContent(e);
    }
    resetContent(e) {
      (this.core.setContent(e ?? this.settings.__initialContent ?? ``, { addToHistory: !1 }),
        this.setDirty(!1));
    }
    getBody() {
      return this.core.view.dom;
    }
    getElement() {
      return this.targetElm;
    }
    getContainer() {
      return this.core.root;
    }
    getContentAreaContainer() {
      return this.core.view.dom.parentElement ?? this.core.root;
    }
    getDoc() {
      return this.core.root.ownerDocument;
    }
    getWin() {
      return this.core.root.ownerDocument.defaultView;
    }
    execCommand(e, t, n) {
      let r = e.toLowerCase(),
        i = !1;
      if (T[r]) i = this.core.exec(T[r]);
      else if (r === `formatblock` || r === `mcetoggleformat`) {
        let e = E[String(n ?? ``).toLowerCase()];
        i = e ? this.core.exec(e) : !1;
      } else if (r === `mceinsertcontent` || r === `inserthtml`)
        (this.insertContent(String(n ?? ``)), (i = !0));
      else if (r === `mcesetcontent`) (this.setContent(String(n ?? ``)), (i = !0));
      else if (r === `selectall`) {
        let { state: e, dispatch: t } = this.core.view;
        (t(e.tr.setSelection(new c(e.doc))), (i = !0));
      } else if (r === `mcecleanup`) i = !0;
      else {
        let e = this.commands.get(r);
        e && (e(t, n), (i = !0));
      }
      return (i && this.fire(`ExecCommand`, { command: e, ui: t, value: n }), i);
    }
    queryCommandState(e) {
      let t = T[e.toLowerCase()];
      return t ? this.core.isActive(t) : !1;
    }
    queryCommandSupported(e) {
      let t = e.toLowerCase();
      return (
        t in T ||
        [`formatblock`, `mceinsertcontent`, `mcesetcontent`].includes(t) ||
        this.commands.has(t)
      );
    }
    commands = new Map();
    addCommand(e, t) {
      this.commands.set(e.toLowerCase(), t);
    }
    on(e, t, n = !1) {
      for (let r of e.toLowerCase().split(/\s+/).filter(Boolean)) {
        let e = this.handlers.get(r) ?? new Set();
        n ? this.handlers.set(r, new Set([t, ...e])) : this.handlers.set(r, e.add(t));
      }
      return this;
    }
    off(e, t) {
      if (!e) return (this.handlers.clear(), this);
      for (let n of e.toLowerCase().split(/\s+/).filter(Boolean))
        t ? this.handlers.get(n)?.delete(t) : this.handlers.delete(n);
      return this;
    }
    once(e, t) {
      let n = (r) => (this.off(e, n), t(r));
      return this.on(e, n);
    }
    fire(e, t = {}) {
      let n = Object.assign(t, { type: e.toLowerCase(), target: this });
      for (let t of [...(this.handlers.get(e.toLowerCase()) ?? [])])
        try {
          t(n);
        } catch (t) {
          console.error(`[nova] tinymce-compat: "${e}" handler failed`, t);
        }
      return n;
    }
    fireNative(e, t) {
      for (let n of [...(this.handlers.get(e) ?? [])])
        try {
          n(t);
        } catch (t) {
          console.error(`[nova] tinymce-compat: "${e}" handler failed`, t);
        }
    }
    static registerIcon(e, t) {
      N.set(e, t);
    }
    dispatch(e, t) {
      return this.fire(e, t);
    }
    hasEventListeners(e) {
      return (this.handlers.get(e.toLowerCase())?.size ?? 0) > 0;
    }
    isDirty() {
      return this.dirty;
    }
    setDirty(e) {
      let t = this.dirty !== e;
      ((this.dirty = e), t && e && this.fire(`Dirty`));
    }
    save() {
      let e = this.getContent(),
        t = this.fire(`SaveContent`, { content: e });
      return (
        this.targetElm instanceof HTMLTextAreaElement && (this.targetElm.value = String(t.content)),
        this.setDirty(!1),
        String(t.content)
      );
    }
    focus() {
      this.core.focus();
    }
    hasFocus() {
      return this.core.view.hasFocus();
    }
    hide() {
      ((this.core.root.hidden = !0),
        this.targetElm instanceof HTMLTextAreaElement && (this.targetElm.hidden = !1));
    }
    show() {
      ((this.core.root.hidden = !1),
        this.targetElm instanceof HTMLTextAreaElement && (this.targetElm.hidden = !0));
    }
    isHidden() {
      return this.core.root.hidden === !0;
    }
    getParam(e, t) {
      return e in this.settings ? this.settings[e] : t;
    }
    options = {
      get: (e) => this.settings[e],
      set: (e, t) => (
        (this.settings[e] = t),
        e === `disabled` && this.core.setDisabled(t === !0),
        !0
      ),
      isSet: (e) => e in this.settings,
      isRegistered: () => !0,
      register: () => {},
    };
    mode = {
      get: () => (this.core.isEditable() ? `design` : `readonly`),
      set: (e) => this.core.setEditable(e !== `readonly`),
      isReadOnly: () => !this.core.isEditable(),
    };
    undoManager = {
      undo: () => this.core.exec(`undo`),
      redo: () => this.core.exec(`redo`),
      hasUndo: () => this.core.can(`undo`),
      hasRedo: () => this.core.can(`redo`),
      add: () => null,
      clear: () => {},
      transact: (e) => (e(), null),
      ignore: (e) => e(),
    };
    selection = {
      getContent: (e = {}) => {
        let { state: t } = this.core.view,
          { from: n, to: r } = t.selection;
        return e.format === `text`
          ? t.doc.textBetween(
              n,
              r,
              `
`,
            )
          : w.serializeFragment(t.selection.content().content);
      },
      setContent: (e) => this.insertContent(e),
      getNode: () => {
        let { from: e } = this.core.view.state.selection,
          { node: t } = this.core.view.domAtPos(e);
        return t instanceof Element ? t : t.parentElement;
      },
      getStart: () => this.selection.getNode(),
      getEnd: () => this.selection.getNode(),
      isCollapsed: () => this.core.view.state.selection.empty,
      collapse: (e = !1) => {
        let { state: t, dispatch: n } = this.core.view,
          r = e ? t.selection.from : t.selection.to;
        n(t.tr.setSelection(o.near(t.doc.resolve(r))));
      },
      setCursorLocation: (e, t = 0) => {
        let { view: n } = this.core;
        if (!e || !n.dom.contains(e)) return;
        let r = n.posAtDOM(e, t);
        n.dispatch(n.state.tr.setSelection(o.near(n.state.doc.resolve(r))));
      },
      select: (e, t = !1) => {
        let { view: n } = this.core;
        if (!n.dom.contains(e)) return;
        let r = n.posAtDOM(e, 0),
          i = n.posAtDOM(e, e.childNodes.length),
          { doc: a } = n.state,
          c =
            !t && e instanceof HTMLImageElement
              ? s.create(a, Math.max(0, r - +!a.resolve(r).nodeAfter))
              : o.between(a.resolve(r), a.resolve(i));
        n.dispatch(n.state.tr.setSelection(c));
      },
    };
    notificationManager = {
      open: (e) =>
        this.core.ui.notify({
          text: e.text,
          ...(e.type ? { type: e.type } : {}),
          ...(e.timeout === void 0 ? {} : { timeout: e.timeout }),
        }),
      close: () => {},
    };
    windowManager = {
      alert: (e, t) => {
        let n = document.createElement(`p`);
        ((n.textContent = e),
          this.core.ui.openDialog({
            title: ``,
            body: n,
            onSubmit: () => !0,
            ...(t ? { onClose: t } : {}),
          }));
      },
      confirm: (e, t) => {
        let n = document.createElement(`p`);
        n.textContent = e;
        let r = !1;
        this.core.ui.openDialog({
          title: ``,
          body: n,
          submitLabel: `OK`,
          onSubmit: () => ((r = !0), !0),
          onClose: () => t?.(r),
        });
      },
      open: (e) => C(this.core, e, (e) => this.windowManager.open(e)),
    };
    ui = {
      registry: {
        addIcon: (e, t) => {
          N.set(e, t);
        },
        addButton: (e, t) => this.addButton(e, t, !1),
        addToggleButton: (e, t) => this.addButton(e, t, !0),
        addMenuButton: (e, t) => {
          let n = [];
          t.fetch((e) => (n = e));
          let r = P(t.icon);
          this.core.ui.registry.addMenuButton(e, {
            tooltip: t.tooltip ?? t.text ?? e,
            ...(r ? { icon: r } : { text: t.text ?? e }),
            items: () => (
              t.fetch((e) => (n = e)),
              n.map((t, n) =>
                t.type === `separator`
                  ? { type: `separator` }
                  : { id: `${e}-${n}`, label: t.text ?? ``, onSelect: () => t.onAction?.({}) },
              )
            ),
          });
        },
        addMenuItem: (e, t) => {
          let n = P(t.icon);
          this.core.ui.registry.addMenuItem(e, {
            text: t.text ?? e,
            ...(n ? { icon: n } : {}),
            onAction: () => t.onAction?.({}),
          });
        },
        addContextToolbar: (e, t) => {
          this.core.ui.registry.addContextToolbar(e, {
            label: t.label ?? e,
            items: t.items,
            position: t.position === `node` ? `node` : `selection`,
            predicate: () => {
              let e = this.selection.getNode();
              return !!e && this.getBody().contains(e) && t.predicate(e);
            },
          });
        },
        addContextForm: () => {
          console.warn(`[nova] tinymce-compat: addContextForm is not supported yet`);
        },
        getAll: () => ({}),
      },
    };
    addButton(e, t, n) {
      let { api: r, state: i } = F(this);
      (t.enabled === !1 && r.setEnabled(!1), t.active && r.setActive(!0));
      let a = P(t.icon);
      if (
        (this.core.ui.registry.addButton(e, {
          tooltip: t.tooltip ?? t.text ?? e,
          ...(a ? { icon: a } : { text: t.text ?? e }),
          isEnabled: () => i.enabled,
          ...(n ? { isActive: () => i.active } : {}),
          onAction: () => t.onAction?.(r),
        }),
        t.onSetup)
      ) {
        let e = () => {
          let e = t.onSetup(r);
          typeof e == `function` && this.teardowns.push(e);
        };
        this.initialized ? e() : this.once(`init`, e);
      }
    }
    dom = {
      select: (e, t) => [...(t ?? this.getBody()).querySelectorAll(e)],
      get: (e) => (typeof e == `string` ? this.getBody().querySelector(`#${CSS.escape(e)}`) : e),
      getParent: (e, t) => {
        let n = e instanceof Element ? e : (e?.parentElement ?? null);
        for (; n && n !== this.getBody();) {
          if (typeof t == `string` ? n.matches(t) : t(n)) return n;
          n = n.parentElement;
        }
        return null;
      },
      getParents: (e, t) => {
        let n = [],
          r = e instanceof Element ? e : (e?.parentElement ?? null);
        for (; r && r !== this.getBody();)
          ((!t || r.matches(t)) && n.push(r), (r = r.parentElement));
        return n;
      },
      is: (e, t) => !!e?.matches(t),
      getAttrib: (e, t, n = ``) => e?.getAttribute(t) ?? n,
      hasClass: (e, t) => !!e?.classList.contains(t),
      getStyle: (e, t) => (e instanceof HTMLElement ? e.style.getPropertyValue(t) : ``),
      getRoot: () => this.getBody(),
      encode: (e) => e.replace(/[&<>"']/g, (e) => `&#${e.charCodeAt(0)};`),
      decode: (e) => {
        let t = document.createElement(`textarea`);
        return ((t.innerHTML = e), t.value);
      },
      create: (e, t = {}, n) => {
        let r = document.createElement(e);
        for (let [e, n] of Object.entries(t)) e.startsWith(`on`) || r.setAttribute(e, n);
        return (n !== void 0 && (r.textContent = n), r);
      },
      uniqueId: (e = `mce_`) => `${e}${Math.random().toString(36).slice(2, 10)}`,
      setAttrib: () => M(`setAttrib`),
      addClass: () => M(`addClass`),
      removeClass: () => M(`removeClass`),
      setStyle: () => M(`setStyle`),
      remove: () => M(`remove`),
    };
    formatter = {
      apply: (e, t = {}) => this.applyFormat(e, t, `apply`),
      remove: (e) => this.applyFormat(e, {}, `remove`),
      toggle: (e, t = {}) => this.applyFormat(e, t, this.formatter.match(e) ? `remove` : `apply`),
      match: (e) => {
        if (this.core.formatter.has(e)) return this.core.formatter.match(e);
        let t = e.toLowerCase();
        if (k.has(t)) return this.blockMatches(t);
        let r = O[t];
        if (r) return this.core.isActive(r);
        let i = j[t];
        if (!i) return !1;
        let { state: a } = this.core.view,
          { from: o, to: s, empty: c } = a.selection,
          l = a.schema.marks[i];
        return c || !l ? n(a, i) !== null : a.doc.rangeHasMark(o, s, l);
      },
      canApply: (e) => this.core.formatter.has(e) || e.toLowerCase() in O || e.toLowerCase() in j,
      register: (e, t) => {
        let n = typeof e == `string` ? [[e, t]] : Object.entries(e);
        for (let [e, t] of n) {
          let n = _(t);
          n.length
            ? this.core.formatter.register(e, n)
            : console.warn(`[nova] tinymce-compat: format "${e}" is not supported yet`);
        }
      },
      unregister: (e) => this.core.formatter.unregister(e),
      get: (e) => this.core.formatter.get(e),
    };
    blockMatches(e) {
      let { $from: t } = this.core.view.state.selection;
      for (let n = t.depth; n > 0; --n) {
        let r = t.node(n),
          i = r.type.name;
        if (e === `blockquote` && i === `blockquote`) return !0;
        if (n === t.depth) {
          if (e === `p`) return i === `paragraph`;
          if (e === `pre`) return i === `code_block`;
          if (/^h[1-6]$/.test(e)) return i === `heading` && r.attrs.level === Number(e[1]);
        }
      }
      let n = null;
      if (
        (this.core.view.state.doc.descendants((e) =>
          n || !e.isTextblock ? !n : ((n = { name: e.type.name, level: e.attrs.level }), !1),
        ),
        !t.depth && n)
      ) {
        let t = n;
        if (e === `p`) return t.name === `paragraph`;
        if (e === `pre`) return t.name === `code_block`;
        if (/^h[1-6]$/.test(e)) return t.name === `heading` && t.level === Number(e[1]);
      }
      return !1;
    }
    applyFormat(e, n, r) {
      if (this.core.formatter.has(e)) {
        r === `apply` ? this.core.formatter.apply(e) : this.core.formatter.remove(e);
        return;
      }
      let i = e.toLowerCase(),
        a = O[i];
      if (a) {
        let e = this.formatter.match(i);
        A.has(i)
          ? r === `apply`
            ? this.core.exec(a)
            : e && this.core.exec(`paragraph`)
          : (r === `apply`) !== e && this.core.exec(a);
        return;
      }
      let o = j[i];
      o
        ? this.core.exec(t(o, r === `apply` ? (n.value ?? null) : null))
        : console.warn(`[nova] tinymce-compat: format "${e}" is not supported yet`);
    }
    remove() {
      this.removed ||
        (this.fire(`remove`),
        this.save(),
        this.teardowns.splice(0).forEach((e) => e()),
        (this.removed = !0),
        this.core.destroy(),
        this.core.root.remove(),
        this.settings.__wrapper?.remove(),
        (this.targetElm.hidden = !1),
        this.off());
    }
    destroy() {
      this.remove();
    }
  },
  L = new Set();
function R(e) {
  L.has(e) || (L.add(e), console.warn(`[nova] tinymce-compat: ${e}`));
}
var z = 0,
  B = (e) => (typeof e == `number` ? `${e}px` : String(e));
function te() {
  let t = [],
    n = new Map(),
    r = null;
  async function i(i, a) {
    let o = t.find((e) => e.targetElm === i && !e.removed);
    if (o) return o;
    let { options: s, unknown: c, missingPlugins: l } = y(a);
    c.length && R(`options not supported yet: ${c.join(`, `)}`);
    let u = String(Array.isArray(a.plugins) ? a.plugins.join(` `) : (a.plugins ?? ``))
        .split(/[\s,]+/)
        .filter((e) => n.has(e)),
      d = l.filter((e) => !n.has(e));
    d.length && R(`plugins not available: ${d.join(`, `)}`);
    let f = i.id || `mce_${++z}`;
    i.id ||= f;
    let p = i instanceof HTMLTextAreaElement,
      m = p ? i.value : i.innerHTML,
      h = { ...a, __initialContent: m },
      g;
    a.inline === !0 && !p
      ? (i.replaceChildren(), (g = i))
      : ((g = document.createElement(`div`)),
        (g.className = `nova-compat`),
        i.after(g),
        (i.hidden = !0),
        (h.__wrapper = g));
    let _,
      v = e({
        ...s,
        element: g,
        content: m,
        setup: (e) => {
          _ = new I(e, i, f, h);
          for (let e of u)
            try {
              n.get(e)(_, ``);
            } catch (t) {
              console.error(`[nova] tinymce-compat: plugin "${e}" failed`, t);
            }
          a.setup?.(_);
        },
      });
    (a.height !== void 0 && (v.root.style.height = B(a.height)),
      a.min_height !== void 0 && (v.root.style.minHeight = B(a.min_height)),
      a.max_height !== void 0 && (v.root.style.maxHeight = B(a.max_height)),
      a.width !== void 0 && (v.root.style.width = B(a.width)));
    let b = !1;
    (v.on(`change`, () => {
      (_.setDirty(!0), (b = !0), _.fire(`input`));
    }),
      v.on(`selectionChange`, () => {
        _.fire(`NodeChange`, { element: _.selection.getNode(), selectionChange: !0 });
      }),
      v.on(`focus`, () => {
        ((r = _), (b = !1), _.fire(`focus`));
      }),
      v.on(`blur`, () => {
        (b && _.fire(`change`, { level: { content: _.getContent() } }), (b = !1), _.fire(`blur`));
      }));
    for (let e of [
      `keydown`,
      `keyup`,
      `keypress`,
      `click`,
      `dblclick`,
      `mousedown`,
      `mouseup`,
      `paste`,
      `copy`,
      `cut`,
      `drop`,
    ])
      v.view.dom.addEventListener(e, (t) => _.fireNative(e, t));
    return (
      (p ? i.form : i.closest(`form`))?.addEventListener(`submit`, () => _.save()),
      _.on(`remove`, () => {
        let e = t.indexOf(_);
        (e >= 0 && t.splice(e, 1), r === _ && (r = t[0] ?? null));
      }),
      t.push(_),
      (r ??= _),
      await v.ready,
      _.removed || ((_.initialized = !0), _.fire(`init`), a.init_instance_callback?.(_)),
      _
    );
  }
  return {
    majorVersion: `7`,
    minorVersion: `0.0`,
    novaprose: !0,
    get activeEditor() {
      return r;
    },
    get editors() {
      return [...t];
    },
    async init(e) {
      document.readyState === `loading` &&
        (await new Promise((e) => document.addEventListener(`DOMContentLoaded`, e, { once: !0 })));
      let t = e.target ? [e.target] : e.selector ? [...document.querySelectorAll(e.selector)] : [];
      t.length || R(`no elements match "${e.selector ?? ``}"`);
      let n = [];
      for (let r of t) n.push(await i(r, e));
      return n;
    },
    get: (e) =>
      e === void 0
        ? [...t]
        : typeof e == `number`
          ? (t[e] ?? null)
          : (t.find((t) => t.id === e) ?? null),
    remove(e) {
      (e === void 0
        ? [...t]
        : typeof e == `string`
          ? t.filter((t) => t.id === e.replace(/^#/, ``) || t.targetElm.matches(e))
          : [e]
      ).forEach((e) => e.remove());
    },
    triggerSave() {
      t.forEach((e) => e.save());
    },
    execCommand(e, t, n) {
      return r?.execCommand(e, t, n) ?? !1;
    },
    PluginManager: {
      add: (e, t) => {
        n.set(e, t);
      },
      get: (e) => n.get(e),
      requireLangPack: () => {},
      urls: {},
    },
    IconManager: {
      add: (e, t) => {
        for (let [e, n] of Object.entries(t.icons ?? {})) I.registerIcon(e, n);
      },
    },
    util: { I18n: { translate: (e) => e } },
  };
}
var V = te(),
  H = `lists link image table code charmap anchor callout`,
  U = `undo redo | blocks | bold italic underline | bullist numlist | link image table | callout code`,
  W = /^[a-z0-9_|, -]{0,400}$/i,
  G = document.getElementById(`np-tiny-plugins`),
  K = document.getElementById(`np-tiny-toolbar`),
  q = document.getElementById(`np-tiny-code`),
  J = document.getElementById(`np-tiny-warn`),
  Y = document.getElementById(`np-tiny-events`),
  X = [],
  Z = (e) => {
    X[X.length - 1] !== e && (X.push(e), (Y.textContent = X.slice(-8).join(` → `)));
  };
V.PluginManager.add(`callout`, (e) => {
  e.ui.registry.addButton(`callout`, {
    text: `Callout`,
    tooltip: `Insert a callout`,
    onAction: () =>
      e.windowManager.open({
        title: `Insert callout`,
        body: {
          type: `panel`,
          items: [
            { type: `input`, name: `text`, label: `Text` },
            {
              type: `selectbox`,
              name: `kind`,
              label: `Kind`,
              items: [
                { text: `Note`, value: `Note` },
                { text: `Tip`, value: `Tip` },
                { text: `Warning`, value: `Warning` },
              ],
            },
          ],
        },
        initialData: { kind: `Tip` },
        buttons: [
          { type: `cancel`, text: `Cancel` },
          { type: `submit`, text: `Insert`, primary: !0 },
        ],
        onSubmit: (t) => {
          let n = t.getData();
          (e.insertContent(
            `<blockquote><p><strong>${e.dom.encode(n.kind)}:</strong> ${e.dom.encode(n.text || `…`)}</p></blockquote>`,
          ),
            t.close());
        },
      }),
  });
});
var ne = (e, t) => {
    q.textContent = `tinymce.init({
  selector: '#editor',
  plugins: '${e}',
  toolbar: '${t}',
  menubar: false,
  height: 380,
  setup: (editor) => {
    editor.on('init input change', (e) => log(e.type));
  },
});`;
  },
  Q = null;
async function $(e, t) {
  if (!W.test(e) || !W.test(t)) {
    J.textContent = `Use plugin and button names only (letters, digits, “|”, spaces).`;
    return;
  }
  let n = V.get(`np-tiny-editor`);
  (n && ((Q = n.getContent()), V.remove(`#np-tiny-editor`)), ne(e, t));
  let r = [],
    i = console.warn;
  console.warn = (...e) => {
    let t = String(e[0] ?? ``);
    t.startsWith(`[nova] tinymce-compat:`)
      ? r.push(t.replace(`[nova] tinymce-compat: `, ``))
      : i(...e);
  };
  try {
    let [n] = await V.init({
      selector: `#np-tiny-editor`,
      plugins: e,
      toolbar: t,
      menubar: !1,
      height: 380,
      setup: (e) => {
        e.on(`init input change`, (e) => Z(String(e.type)));
      },
    });
    Q !== null && n?.setContent(Q);
  } finally {
    console.warn = i;
  }
  J.textContent = r.length ? `Not available yet: ${r.join(`; `)}` : ``;
}
(document.getElementById(`np-tiny-apply`).addEventListener(`click`, () => {
  $(G.value.trim(), K.value.trim());
}),
  document.getElementById(`np-tiny-reset`).addEventListener(`click`, () => {
    ((G.value = H), (K.value = U), $(H, U));
  }),
  $(H, U));
