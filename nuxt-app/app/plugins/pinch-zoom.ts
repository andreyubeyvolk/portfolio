import { attachPinchZoom } from '../utils/pinchZoom'

// v-pinch-zoom on an <img>: Instagram-style pinch + long-press loupe (see
// utils/pinchZoom.ts). Registered for SSR too (with empty SSR props) so the
// template compiles identically on server and client--the behavior itself
// only attaches in the browser.
const cleanups = new WeakMap<HTMLElement, () => void>()

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('pinch-zoom', {
    mounted(el: HTMLImageElement) {
      cleanups.set(el, attachPinchZoom(el))
    },
    unmounted(el: HTMLImageElement) {
      cleanups.get(el)?.()
      cleanups.delete(el)
    },
    getSSRProps: () => ({}),
  })
})
