<script setup lang="ts">
// Ported from main.js's copy-email IIFE, as a component instead of a
// global querySelectorAll pass: main.js ran once against whatever was in
// the DOM at that moment, which doesn't work in an SPA where a page (and
// its copy buttons) can mount long after the app first loaded. A Vue
// component binds its own click handler on its own mount, which handles
// that case for free.
const props = defineProps<{ email: string }>()

const isCopied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(props.email)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = props.email
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '-999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    clearTimeout(timer)
    isCopied.value = true
    timer = setTimeout(() => { isCopied.value = false }, 1600)
  } catch {
    window.location.href = `mailto:${props.email}`
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <button class="contact-link" type="button" :class="{ 'is-copied': isCopied }" @click="copy">
    <slot>Mail</slot><span class="copy-label" aria-hidden="true">Copied</span>
  </button>
</template>
