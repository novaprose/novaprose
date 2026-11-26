# NovaProse examples

Small, complete projects. Open one in the browser with StackBlitz (nothing to install) or copy the
folder and run `npm install && npm run dev`.

| Example                          | What it shows                                                                                | Open                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [react](./react)                 | `<NovaProseEditor>`, a new block type drawn by a React component (node view), formulas, code | [StackBlitz](https://stackblitz.com/github/novaprose/novaprose/tree/main/examples/react?file=src%2Fcallout.tsx) |
| [vue](./vue)                     | the same in Vue: `v-model`, a node view in a single-file component                           | [StackBlitz](https://stackblitz.com/github/novaprose/novaprose/tree/main/examples/vue?file=src%2FCallout.vue)   |
| [cdn](./cdn)                     | no build step: `<novaprose-editor>` from a CDN as a field of a plain HTML form               | [StackBlitz](https://stackblitz.com/github/novaprose/novaprose/tree/main/examples/cdn?file=index.html)          |
| [server-render](./server-render) | Node: a saved JSON document to HTML and text without an editor (emails, previews, SSR)       | [StackBlitz](https://stackblitz.com/github/novaprose/novaprose/tree/main/examples/server-render?file=render.js) |

Documentation: [novaprose.com](https://novaprose.com).

Before every release the examples are installed from the package archives and checked in a
browser (`pnpm verify:examples` in the repository), so they work with the version they name.
