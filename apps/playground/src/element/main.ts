import '@novaprose/core/style.css';
import '../playground.css';
import '@novaprose/web-component/define';

/**
 * The web component playground: <novaprose-editor> in a regular form (FormData, reset, required,
 * fieldset disabled). e2e/element.spec.ts drives it.
 */
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const form = $<HTMLFormElement>('#form');
const body = $('#body');
let inputs = 0;
let changes = 0;

body.addEventListener('input', () => ($('#inputs').textContent = String(++inputs)));
body.addEventListener('change', () => ($('#changes').textContent = String(++changes)));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  $('#submitted').textContent = JSON.stringify(Object.fromEntries(new FormData(form)), null, 2);
});
$<HTMLInputElement>('#disable').addEventListener('change', (event) => {
  $<HTMLFieldSetElement>('#fieldset').disabled = (event.target as HTMLInputElement).checked;
});
