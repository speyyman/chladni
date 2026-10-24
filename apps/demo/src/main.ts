import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-600.css'
import '@fontsource/martian-mono/latin-400.css'
import './style.css'
import { Bench, type PlateShape } from 'chladni'
import { soundFrequency, soundOff, soundOn } from './audio'

const MIN_HZ = 40
const MAX_HZ = 1600
const GRAINS = 20000
// With reduced motion the sand jumps straight to its pattern: this many steps at once.
const SETTLE = 600

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const canvas = $<HTMLCanvasElement>('plate')
const ctx = canvas.getContext('2d', { alpha: false })!
const freq = $<HTMLInputElement>('freq')
const hzOut = $('hz')
const statusOut = $('status')
const scale = $('scale')
const modesList = $('modes')
const sweepBtn = $<HTMLButtonElement>('sweep')
const linesBtn = $<HTMLButtonElement>('lines')
const soundBtn = $<HTMLButtonElement>('sound')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const
const COLORS = { bench: hex(css('--bench')), steel: hex(css('--steel')), edge: hex(css('--steel-edge')), quartz: hex(css('--quartz')) }

// Slider position ↔ hertz, on a log scale.
const toHz = (v: number) => MIN_HZ * (MAX_HZ / MIN_HZ) ** (v / 1000)
const toPos = (hz: number) => (1000 * Math.log(hz / MIN_HZ)) / Math.log(MAX_HZ / MIN_HZ)

const benches = new Map<PlateShape, Bench>()
let bench: Bench
let showLines = false
let sounding = false
let sweeping = false
let stepsPerFrame = 2
let sweepHz = 0

// ---------------------------------------------------------------- drawing

let size = 0
let image: ImageData
let pixels: Uint32Array
let template: Uint32Array
const pack = ([r, g, b]: readonly number[]) => (255 << 24) | (b! << 16) | (g! << 8) | r!

/** Size the canvas to its box and paint the empty plate once into a template. */
function resize() {
  const css = Math.round(canvas.getBoundingClientRect().width)
  const next = Math.min(1024, Math.round(css * Math.min(2, devicePixelRatio || 1)))
  if (next === size) return
  size = next
  canvas.width = size
  canvas.height = size
  image = ctx.createImageData(size, size)
  pixels = new Uint32Array(image.data.buffer)
  template = new Uint32Array(size * size)
  const bench32 = pack(COLORS.bench)
  const steel32 = pack(COLORS.steel)
  const edge32 = pack(COLORS.edge)
  const pad = Math.round(size * 0.03)
  const inner = size - 2 * pad
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = ((x - pad + 0.5) / inner) * 2 - 1
      const v = ((y - pad + 0.5) / inner) * 2 - 1
      let c = bench32
      if (bench?.shape === 'circle') {
        const r = Math.hypot(u, v)
        if (r <= 1) c = r > 1 - 2.5 / inner ? edge32 : steel32
      } else if (Math.abs(u) <= 1 && Math.abs(v) <= 1) c = Math.max(Math.abs(u), Math.abs(v)) > 1 - 2.5 / inner ? edge32 : steel32
      template[y * size + x] = c
    }
}

function plateToCanvas(x: number, y: number) {
  const pad = size * 0.03
  const inner = size - 2 * pad
  return { x: pad + ((x + 1) / 2) * inner, y: pad + ((y + 1) / 2) * inner }
}

function draw() {
  pixels.set(template)
  const quartz = pack(COLORS.quartz)
  const { x: gx, y: gy } = bench.sand
  const pad = size * 0.03
  const inner = size - 2 * pad
  const dot = size >= 800 ? 2 : 1
  for (let i = 0; i < gx.length; i++) {
    const px = Math.floor(pad + ((gx[i]! + 1) / 2) * inner)
    const py = Math.floor(pad + ((gy[i]! + 1) / 2) * inner)
    for (let dy = 0; dy < dot; dy++)
      for (let dx = 0; dx < dot; dx++) {
        const X = px + dx
        const Y = py + dy
        if (X >= 0 && X < size && Y >= 0 && Y < size) pixels[Y * size + X] = quartz
      }
  }
  ctx.putImageData(image, 0, 0)
  if (showLines) {
    const segs = bench.nodalLines()
    ctx.strokeStyle = css('--straw')
    ctx.lineWidth = Math.max(1, size / 400)
    ctx.beginPath()
    for (let i = 0; i < segs.length; i += 4) {
      const a = plateToCanvas(segs[i]!, segs[i + 1]!)
      const b = plateToCanvas(segs[i + 2]!, segs[i + 3]!)
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
    }
    ctx.stroke()
  }
  // The drive point: a bronze ring.
  const d = plateToCanvas(bench.drivePoint.x, bench.drivePoint.y)
  ctx.strokeStyle = css('--bronze')
  ctx.lineWidth = Math.max(2, size / 300)
  ctx.beginPath()
  ctx.arc(d.x, d.y, size / 70, 0, Math.PI * 2)
  ctx.stroke()
}

// ---------------------------------------------------------------- readouts

function renderModes() {
  scale.replaceChildren(
    ...bench.resonances.map((r) => {
      const t = document.createElement('span')
      t.className = 'tick'
      t.dataset.index = String(r.index)
      t.style.left = `${toPos(r.hz) / 10}%`
      return t
    }),
    Object.assign(document.createElement('span'), { className: 'needle' }),
  )
  modesList.replaceChildren(
    ...bench.resonances.map((r) => {
      const li = document.createElement('li')
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.index = String(r.index)
      b.innerHTML = `<span>${r.hz.toFixed(1)} Hz</span><span class="om">Ω ${r.omega.toFixed(2)}</span><span>${bench.shape === 'circle' ? `n,s ${r.label}` : r.label}</span>`
      b.setAttribute(
        'aria-label',
        `${r.hz.toFixed(1)} hertz, frequency parameter ${r.omega.toFixed(2)}, ${bench.shape === 'circle' ? `${r.label.split(',')[0]} nodal diameters and ${r.label.split(',')[1]} nodal circles` : `symmetry ${r.label}`}`,
      )
      b.addEventListener('click', () => {
        stopSweep()
        setHz(r.hz)
      })
      li.append(b)
      return li
    }),
  )
}

function updateReadouts() {
  const hz = bench.hz
  hzOut.textContent = `${hz < 100 ? hz.toFixed(1) : hz.toFixed(0)} Hz`
  $('omega').textContent = (bench.hz / (bench.resonances[0]!.hz / bench.resonances[0]!.omega)).toFixed(2)
  const near = bench.nearest(hz)
  const strength = bench.strength
  $('nearest').textContent = near ? `${near.hz.toFixed(1)} Hz` : '–'
  $('strength').textContent = strength < 0.05 ? 'too weak to throw sand' : strength.toFixed(2)
  $('grains').textContent = bench.sand.count.toLocaleString('en-US')
  const needle = scale.querySelector<HTMLElement>('.needle')
  if (needle) needle.style.left = `${toPos(hz) / 10}%`
  const onMode = near && Math.abs(Math.log(near.hz / hz)) < 0.004 ? near.index : -1
  for (const t of scale.querySelectorAll<HTMLElement>('.tick')) t.classList.toggle('current', Number(t.dataset.index) === onMode)
  for (const b of modesList.querySelectorAll<HTMLButtonElement>('button'))
    b.setAttribute('aria-current', String(Number(b.dataset.index) === onMode))
  canvas.setAttribute(
    'aria-label',
    `A ${bench.shape === 'circle' ? 'steel disc' : 'square steel plate'} driven at ${hz.toFixed(1)} hertz${onMode >= 0 ? ', at a resonance' : ''}. ${strength < 0.05 ? 'The plate barely moves and the sand stays where it is.' : 'Sand is gathering on the lines that stay still.'}`,
  )
}

// ---------------------------------------------------------------- state changes

function setHz(hz: number, { fromSlider = false } = {}) {
  bench.setHz(Math.min(MAX_HZ, Math.max(MIN_HZ, hz)))
  if (!fromSlider) freq.value = String(Math.round(toPos(bench.hz)))
  if (sounding) soundFrequency(bench.hz)
  if (reduced.matches) bench.step(SETTLE)
  updateReadouts()
  draw()
}

function useShape(shape: PlateShape) {
  stopSweep()
  let b = benches.get(shape)
  if (!b) {
    statusOut.textContent = 'Computing modes…'
    b = new Bench({ shape, grains: bench?.sand.count ?? GRAINS })
    benches.set(shape, b)
  }
  bench = b
  for (const s of document.querySelectorAll<HTMLButtonElement>('[data-shape]'))
    s.setAttribute('aria-pressed', String(s.dataset.shape === shape))
  size = 0
  resize()
  renderModes()
  statusOut.textContent = ''
  setHz(bench.resonances[0]!.hz)
}

let lastFrame = 0
function stopSweep() {
  sweeping = false
  sweepBtn.setAttribute('aria-pressed', 'false')
  statusOut.textContent = ''
  statusOut.classList.remove('sweeping')
}

sweepBtn.addEventListener('click', () => {
  if (reduced.matches) {
    // No continuous motion: jump to the next resonance above the current frequency.
    const next = bench.resonances.find((r) => r.hz > bench.hz * 1.001) ?? bench.resonances[0]!
    setHz(next.hz)
    statusOut.textContent = `Jumped to ${next.hz.toFixed(1)} Hz`
    return
  }
  if (sweeping) return stopSweep()
  sweeping = true
  if (bench.hz > MAX_HZ * 0.98) setHz(MIN_HZ)
  sweepHz = bench.hz
  sweepBtn.setAttribute('aria-pressed', 'true')
  statusOut.textContent = 'Sweeping upwards'
  statusOut.classList.add('sweeping')
})

$('scatter').addEventListener('click', () => {
  bench.sand.scatter()
  if (reduced.matches) bench.step(SETTLE)
  draw()
})

linesBtn.addEventListener('click', () => {
  showLines = !showLines
  linesBtn.setAttribute('aria-pressed', String(showLines))
  draw()
})

soundBtn.addEventListener('click', () => {
  sounding = !sounding
  if (sounding) soundOn(bench.hz)
  else soundOff()
  soundBtn.setAttribute('aria-pressed', String(sounding))
  soundBtn.textContent = sounding ? 'Sound on' : 'Sound off'
})

for (const s of document.querySelectorAll<HTMLButtonElement>('[data-shape]'))
  s.addEventListener('click', () => useShape(s.dataset.shape as PlateShape))

freq.addEventListener('input', () => {
  stopSweep()
  setHz(toHz(Number(freq.value)), { fromSlider: true })
})
freq.setAttribute('aria-valuetext', '')
freq.addEventListener('input', () => freq.setAttribute('aria-valuetext', `${bench.hz.toFixed(1)} hertz`))

// The drive point: click or drag on the plate, or arrow keys while the plate has focus.
function moveDrive(x: number, y: number) {
  const r = Math.hypot(x, y)
  const lim = 0.97
  if (bench.shape === 'circle' && r > lim) {
    x *= lim / r
    y *= lim / r
  }
  bench.setDrive({ x: Math.max(-lim, Math.min(lim, x)), y: Math.max(-lim, Math.min(lim, y)) })
  if (reduced.matches) bench.step(SETTLE)
  updateReadouts()
  draw()
}
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect()
  const pad = rect.width * 0.03
  const inner = rect.width - 2 * pad
  moveDrive(((e.clientX - rect.left - pad) / inner) * 2 - 1, ((e.clientY - rect.top - pad) / inner) * 2 - 1)
})
canvas.addEventListener('keydown', (e) => {
  const step = 0.05
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
  if (!d) return
  e.preventDefault()
  moveDrive(bench.drivePoint.x + d[0]!, bench.drivePoint.y + d[1]!)
})

// ---------------------------------------------------------------- the loop

// If a frame's work takes too long, do less: first one sand step per frame, then fewer grains.
let slow = 0
function frame(t: number) {
  const dt = lastFrame ? Math.min(0.1, (t - lastFrame) / 1000) : 0
  lastFrame = t
  if (!reduced.matches) {
    const start = performance.now()
    if (sweeping) {
      // About 6% per second: roughly 3 Hz/s at the bottom of the range, 90 Hz/s at the top.
      sweepHz *= Math.exp(0.06 * dt)
      if (sweepHz >= MAX_HZ) {
        setHz(MAX_HZ)
        stopSweep()
      } else if (Math.abs(Math.log(sweepHz / bench.hz)) > 0.0025) {
        // Recompute the plate's response only every quarter percent, a third of a resonance's width.
        setHz(sweepHz)
      }
    }
    bench.step(stepsPerFrame)
    draw()
    const work = performance.now() - start
    slow = work > 14 ? slow + 1 : Math.max(0, slow - 1)
    if (slow > 30) {
      slow = 0
      if (stepsPerFrame > 1) stepsPerFrame = 1
      else if (bench.sand.count > 5000) {
        bench.setGrains(Math.round(bench.sand.count / 2))
        updateReadouts()
      }
    }
  }
  requestAnimationFrame(frame)
}

addEventListener('resize', () => {
  resize()
  draw()
})
reduced.addEventListener('change', () => {
  stopSweep()
  if (reduced.matches) bench.step(SETTLE)
  draw()
})

// Exposed for the end-to-end tests.
declare global {
  interface Window {
    chladni: { bench: () => Bench; stepsPerFrame: () => number }
  }
}
window.chladni = { bench: () => bench, stepsPerFrame: () => stepsPerFrame }

useShape('square')
requestAnimationFrame(frame)
