/** Текст CSS-файла (импорт с ?raw): сборка — scripts/esbuild-raw-css.mjs, тесты — Vite. */
declare module '*.css?raw' {
  const css: string;
  export default css;
}
