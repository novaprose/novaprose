/** What the tests use of jsdom (its own package has no types): a DOM for HTML on a server. */
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
