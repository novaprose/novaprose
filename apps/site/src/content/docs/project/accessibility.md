---
title: Accessibility
description: How NovaProse works with keyboards, screen readers, zoom and high contrast, how that is tested on every change, and its accessibility conformance report.
---

NovaProse meets WCAG 2.2 Level AA in its own interface and helps people write accessible content.
The details, criterion by criterion, are in the
[accessibility conformance report](/project/accessibility-report/) (VPAT 2.5, International
Edition: WCAG 2.2, Revised Section 508 and EN 301 549).

## What the editor does

- **Keyboard.** Everything works without a mouse. Alt+F10 goes to the toolbar and Alt+F9 to the
  menu bar, the arrow keys move within them and Escape goes back to the text; Alt+0 lists every
  shortcut. Blocks move with Alt+Shift+↑/↓ instead of dragging, and every size can be typed in a
  dialog.
- **Screen readers.** The toolbar, menus, dialogs and the text area have standard roles, names and
  states. A shortcut says what it changed ("Bold on", "Bulleted list"), and so do Markdown
  shortcuts, autocorrect and suggested edits.
- **Seeing the screen.** Text is at least 4.5:1 and the edges of fields, focus rings and pressed
  buttons at least 3:1, in the light and dark themes. The editor works at 200% zoom, on a screen 320
  pixels wide and with wider text spacing; Windows high contrast mode shows every state in the
  system's colors; the system's reduced-motion setting turns animations off.
- **Focus stays in view.** Every control shows a focus ring, and the line with the cursor never goes
  under the sticky toolbar, even under your page's own fixed header (`toolbarStickyOffset`).
- **Languages.** The interface says its language to screen readers, the text can have its own
  (`contentLanguage`), and a phrase in another language is marked with the Language button, so it
  is read with the right voice ([Languages in the text](/guides/localization/#languages-in-the-text)).
- **Accessible content.** The image dialog asks for alternative text and can mark an image
  decorative, tables get header cells and captions, and the
  [accessibility checker](/guides/accessibility-checker/) finds common problems and fixes most of
  them in one step.

## How it is tested

Every change runs these checks in CI ([How NovaProse is tested](/project/testing/)):

- axe-core (WCAG 2.1 A and AA rules) on 42 states of the interface (menus, dialogs, panels, the
  plugins' views), in the light and dark themes;
- what axe doesn't measure: the contrast of field edges, focus rings and pressed buttons computed
  from the drawn colors, text spacing, a 320-pixel screen, the sticky toolbar and the cursor, and
  Windows high contrast;
- NVDA with Chrome on Windows and VoiceOver on macOS (WebKit, the engine of Safari): what a
  person hears after shortcuts and in dialogs;
- keyboard-only use in Chromium, Firefox and WebKit, and touch in an emulated phone;
- axe on every page of this site, in both themes and on a phone-sized screen.

Not tested yet: JAWS, VoiceOver on iPhone and iPad, TalkBack, Dragon NaturallySpeaking and real
phones. There has been no independent audit.

## Report a problem

Accessibility problems are bugs. Open an issue on
[GitHub](https://github.com/novaprose/novaprose/issues) or write to
[hello@novaprose.com](mailto:hello@novaprose.com).
