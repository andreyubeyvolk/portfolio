<script setup lang="ts">
const props = defineProps<{
  size: number
  spinning: boolean
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let viewLon = 0           // current view longitude in degrees

const TILT = 22           // tilt toward viewer in degrees (makes lat lines look elliptical)
const SPEED = 0.45        // degrees per frame (~27°/sec at 60fps)
const DEG = Math.PI / 180
const sinT = Math.sin(TILT * DEG)
const cosT = Math.cos(TILT * DEG)

function project(lat: number, lon: number, r: number) {
  // Orthographic projection from the front (+Z toward viewer)
  const la = lat * DEG
  const dLon = (lon - viewLon) * DEG
  const x = Math.cos(la) * Math.sin(dLon)
  const y = Math.sin(la)
  const z = Math.cos(la) * Math.cos(dLon)
  // Apply X-axis tilt (lean top of globe toward viewer)
  const y2 = y * cosT - z * sinT
  const z2 = y * sinT + z * cosT
  return { sx: cx * r + x * r, sy: cy * r - y2 * r, visible: z2 > -0.04 }
}

// Use a module-level temp to avoid allocating objects per-frame
const cx = 0.5
const cy = 0.5

function drawFrame(ctx: CanvasRenderingContext2D) {
  const s = props.size
  const r = s / 2 - 0.5

  ctx.clearRect(0, 0, s, s)

  const cxPx = s / 2
  const cyPx = s / 2

  // Sphere body — radial gradient gives illusion of directional light from top-left
  const bg = ctx.createRadialGradient(
    cxPx - r * 0.3, cyPx - r * 0.33, r * 0.03,
    cxPx, cyPx, r
  )
  bg.addColorStop(0, '#41444b')
  bg.addColorStop(0.45, '#26282d')
  bg.addColorStop(1, '#131415')
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(cxPx, cyPx, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cxPx, cyPx, r, 0, Math.PI * 2)
  ctx.clip()

  ctx.lineWidth = 0.65
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const STEP = 3   // degrees between polyline sample points

  // Latitude lines
  ctx.strokeStyle = 'rgba(168,175,186,0.38)'
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath()
    let first = true
    for (let lon = -180; lon <= 181; lon += STEP) {
      const p = project(lat, lon, r)
      if (!p.visible) { first = true; continue }
      if (first) { ctx.moveTo(p.sx, p.sy); first = false }
      else ctx.lineTo(p.sx, p.sy)
    }
    ctx.stroke()
  }

  // Longitude meridians
  ctx.strokeStyle = 'rgba(168,175,186,0.38)'
  for (let lon = 0; lon < 360; lon += 30) {
    ctx.beginPath()
    let first = true
    for (let lat = -90; lat <= 90; lat += STEP) {
      const p = project(lat, lon, r)
      if (!p.visible) { first = true; continue }
      if (first) { ctx.moveTo(p.sx, p.sy); first = false }
      else ctx.lineTo(p.sx, p.sy)
    }
    ctx.stroke()
  }

  ctx.restore()

  // Specular highlight — small bright bloom in the illuminated quadrant
  const hl = ctx.createRadialGradient(
    cxPx - r * 0.3, cyPx - r * 0.35, 0,
    cxPx - r * 0.3, cyPx - r * 0.35, r * 0.85
  )
  hl.addColorStop(0, 'rgba(255,255,255,0.11)')
  hl.addColorStop(0.3, 'rgba(255,255,255,0.04)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hl
  ctx.beginPath()
  ctx.arc(cxPx, cyPx, r, 0, Math.PI * 2)
  ctx.fill()
}

function tick() {
  viewLon = (viewLon + SPEED) % 360
  const c = canvas.value
  if (c) {
    const ctx = c.getContext('2d')
    if (ctx) drawFrame(ctx)
  }
  raf = requestAnimationFrame(tick)
}

function stop() {
  if (raf) { cancelAnimationFrame(raf); raf = 0 }
}

watch(() => props.spinning, (v) => {
  if (v) { if (!raf) tick() }
  else stop()
})

onMounted(() => {
  const c = canvas.value
  if (c) {
    const ctx = c.getContext('2d')
    if (ctx) drawFrame(ctx)
  }
})

onUnmounted(stop)
</script>

<template>
  <canvas
    ref="canvas"
    :width="size"
    :height="size"
    :style="{ display: 'block', width: size + 'px', height: size + 'px' }"
  />
</template>
