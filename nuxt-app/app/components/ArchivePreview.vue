<script setup lang="ts">
// Desktop single-image lightbox (Stage 2 of the Archive migration).
// Series cards (their own filmstrip mode) land in Stage 3; the tablet/
// phone card overlay lands in Stage 4--this component only ever opens
// on desktop widths (>980px), matching the static site's own isMobile()
// gate in archive/index.html.
export interface ArchiveLightboxItem {
  src: string
  width: number
  height: number
  alt: string
  title: string
  description: string
  link?: string
  tags?: string
}

const props = defineProps<{ item: ArchiveLightboxItem | null }>()
const emit = defineEmits<{ close: [], prev: [], next: [] }>()

const overlay = useTemplateRef<HTMLElement>('overlay')
const previewImg = useTemplateRef<HTMLImageElement>('previewImg')
const previewHeader = useTemplateRef<HTMLElement>('previewHeader')
const previewText = useTemplateRef<HTMLElement>('previewText')
const previewTags = useTemplateRef<HTMLElement>('previewTags')
const previewInner = useTemplateRef<HTMLElement>('previewInner')

// [hidden]-equivalent (mount/unmount) vs the 'is-open' fade class--kept
// separate so closing can fade out over 260ms before actually unmounting,
// same as the static site's closePreview/closeHideTimer.
const isOpen = ref(false)
const isVisible = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined

const isVertical = computed(() => !!props.item && props.item.height >= props.item.width)
const titleParts = computed(() => props.item ? splitArchiveTitle(props.item.title) : null)
const descParts = computed(() => props.item ? splitArchiveDescription(props.item.description, props.item.link) : null)

function isMobile() {
  return window.matchMedia('(max-width: 980px)').matches
}

async function syncPreviewSize() {
  const img = previewImg.value
  if (!img) return
  if (img.decode) {
    try { await img.decode() } catch { /* a stale/aborted decode--the next syncPreviewSize call (new src) supersedes it */ }
  }
  requestAnimationFrame(() => {
    fitPreviewImage()
    if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
    requestAnimationFrame(() => {
      fitPreviewImage()
      if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
    })
  })
}

function fitPreviewImage() {
  const img = previewImg.value
  const ov = overlay.value
  const header = previewHeader.value
  const text = previewText.value
  const inner = previewInner.value
  if (!img || !ov || !header || !text || !inner) return
  const tagsH = (previewTags.value && props.item?.tags) ? previewTags.value.offsetHeight : 0

  if (isMobile()) {
    const availableHeight = ov.clientHeight - header.offsetHeight - text.offsetHeight - tagsH - 40
    const availableWidth = ov.clientWidth - 32
    const heightByWidth = availableWidth * (img.naturalHeight / img.naturalWidth)
    if (heightByWidth <= availableHeight) {
      img.style.width = '100%'
      img.style.height = 'auto'
      header.style.width = ''
      text.style.width = ''
      inner.style.alignItems = ''
    } else {
      const scaledWidth = availableHeight * (img.naturalWidth / img.naturalHeight)
      img.style.width = `${scaledWidth}px`
      img.style.height = `${availableHeight}px`
      header.style.width = `${scaledWidth}px`
      text.style.width = `${scaledWidth}px`
      inner.style.alignItems = 'flex-end'
    }
  } else {
    const availableHeight2 = ov.clientHeight - header.offsetHeight - text.offsetHeight - tagsH
    const availableWidth2 = ov.clientWidth - 16
    const heightByWidth2 = availableWidth2 * (img.naturalHeight / img.naturalWidth)
    const previewHeight = Math.min(availableHeight2, heightByWidth2)
    ov.style.setProperty('--preview-image-height', `${Math.max(0, previewHeight)}px`)
  }
}

watch(() => props.item, async (item) => {
  if (!item) return
  const wasClosed = !isOpen.value
  clearTimeout(closeTimer)
  isOpen.value = true
  document.body.classList.add('is-preview-open')
  // Let Vue actually apply the new src to the DOM <img> before measuring/
  // decoding it below--reading it in the same synchronous tick would still
  // see the previous element state.
  await nextTick()
  if (wasClosed) {
    requestAnimationFrame(() => { isVisible.value = true })
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }
  await syncPreviewSize()
})

function close() {
  isVisible.value = false
  document.body.classList.remove('is-preview-open')
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    isOpen.value = false
    overlay.value?.style.removeProperty('--preview-width')
    overlay.value?.style.removeProperty('--preview-image-height')
    if (previewImg.value) { previewImg.value.style.width = ''; previewImg.value.style.height = '' }
    if (previewHeader.value) previewHeader.value.style.width = ''
    if (previewText.value) previewText.value.style.width = ''
    if (previewInner.value) previewInner.value.style.alignItems = ''
  }, 260)
  emit('close')
}

function onOverlayClick(event: MouseEvent) {
  if (!previewInner.value?.contains(event.target as Node)) close()
}

function onResize() {
  if (!isOpen.value) return
  fitPreviewImage()
  if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
  fitPreviewImage()
  if (overlay.value && previewImg.value) overlay.value.style.setProperty('--preview-width', `${previewImg.value.getBoundingClientRect().width}px`)
}

function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value || isMobile()) return
  if (event.key === 'Escape') { close(); return }
  if (event.key === ' ') {
    const tag = (event.target as HTMLElement | null)?.tagName
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return
    event.preventDefault()
    emit('next')
    return
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  emit(event.key === 'ArrowRight' ? 'next' : 'prev')
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('is-preview-open')
  clearTimeout(closeTimer)
})
</script>

<template>
  <div
    v-if="isOpen"
    ref="overlay"
    class="archive-preview"
    :class="{ 'is-open': isVisible, 'is-vertical': isVertical, 'is-horizontal': !isVertical }"
    @click="onOverlayClick"
  >
    <button class="close-button preview-close" type="button" @click="close"><span>[X]</span></button>

    <div ref="previewInner" class="archive-preview__inner">
      <header ref="previewHeader" class="content-pane__header project-header">
        <h1 class="preview-title">{{ titleParts?.base }}<sup v-if="titleParts?.badge" class="archive-num">{{ titleParts.badge }}</sup></h1>
      </header>
      <div class="preview-media">
        <img ref="previewImg" class="preview-image" :src="item?.src" :alt="item?.alt || ''" />
        <button class="preview-nav preview-nav--prev" type="button" aria-label="Previous photo" @click="emit('prev')"><span class="preview-nav__arrow">&lt;</span></button>
        <button class="preview-nav preview-nav--next" type="button" aria-label="Next photo" @click="emit('next')"><span class="preview-nav__arrow">&gt;</span></button>
      </div>
      <div ref="previewText" class="preview-text">
        <p v-if="descParts">{{ descParts.before }}<a class="archive-num" :href="item!.link" target="_blank" rel="noreferrer">{{ descParts.linkText }}</a>{{ descParts.after }}</p>
        <p v-else>{{ item?.description }}</p>
      </div>
      <span v-if="item?.tags" ref="previewTags" class="preview-tags">{{ item.tags }}</span>
    </div>
  </div>
</template>
