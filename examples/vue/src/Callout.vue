<script setup lang="ts">
import { NodeViewContent, nodeViewProps } from '@novaprose/vue';
import { computed } from 'vue';

/** The callout as a Vue component: a list in the corner and editable text inside. */
const props = defineProps(nodeViewProps);
const tone = computed(() => String(props.node.attrs.tone));
const tones = { info: 'Info', warning: 'Warning', success: 'Success' };

function setTone(event: Event) {
  props.updateAttributes({ tone: (event.target as HTMLSelectElement).value });
}
</script>

<template>
  <div class="callout" :data-tone="tone">
    <div class="callout-bar" contenteditable="false">
      <select aria-label="Callout tone" :value="tone" @change="setTone">
        <option v-for="(label, value) in tones" :key="value" :value="value">{{ label }}</option>
      </select>
    </div>
    <NodeViewContent class="callout-body" />
  </div>
</template>
