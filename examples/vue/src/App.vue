<script setup lang="ts">
import { NovaProseEditor } from '@novaprose/vue';
import { ref } from 'vue';
import { callout } from './callout';

const INITIAL =
  '<h2>NovaProse + Vue</h2>' +
  '<p>Edit this text. The box below is a <strong>Vue component</strong> inside the document.</p>' +
  '<div data-callout="" data-tone="info"><p>Pick a tone in the list: it is an attribute of the node.</p></div>' +
  '<p>A formula: <span data-type="inline-math" data-latex="E=mc^2"></span>. Type <code>$a^2$</code> for another.</p>';

const html = ref(INITIAL);
const plugins = [callout, 'math', 'codesample'];
const init = {
  toolbar: 'undo redo | blocks | bold italic link | bullist numlist | callout math codesample',
};
</script>

<template>
  <main>
    <NovaProseEditor v-model="html" :plugins="plugins" :init="init" />
    <h3>HTML</h3>
    <pre>{{ html }}</pre>
  </main>
</template>
