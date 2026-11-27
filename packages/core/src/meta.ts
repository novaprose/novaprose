/**
 * Transaction markers shared by the editor and first-load plugins. A module of its own, so a plugin
 * can read them without importing the editor (and everything it brings) into the server's imports.
 */

/** setContent: a document is loaded, not edited (suggesting mode doesn't track it). */
export const SET_CONTENT_META = 'nova:set-content';
