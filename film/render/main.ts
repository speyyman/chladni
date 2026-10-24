/**
 * The page the renderer drives, as in engravings-film: scripts/render.mjs calls
 * `film.setup()`, then `film.frame(i)` for every frame, and reads the canvas back.
 * `?o=portrait&t=40` shows a frame by hand (`npm run dev -w chladni-film`).
 */
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/big-shoulders-display/latin-300'
import { Painter, layoutFor, type Orientation } from '../src/draw.js'
import { FPS, FRAMES, cues, toVTT } from '../src/script.js'

declare global {
  interface Window {
    film: {
      frames: number
      fps: number
      setup(o: { orientation: Orientation }): Promise<{ width: number; height: number }>
      frame(i: number): void
      png(): string
      vtt(): string
    }
  }
}

const canvas = document.getElementById('film') as HTMLCanvasElement
let painter: Painter | undefined

window.film = {
  frames: FRAMES,
  fps: FPS,
  async setup({ orientation }) {
    const L = layoutFor(orientation)
    canvas.width = L.width
    canvas.height = L.height
    await Promise.all([document.fonts.load('400 32px "Geist Mono"'), document.fonts.load('300 120px "Big Shoulders Display"')])
    // Painter needs the resonances for the captions; build it once, then hand it its cues.
    const probe = new Painter(canvas.getContext('2d')!, orientation, [])
    painter = new Painter(canvas.getContext('2d')!, orientation, cues(probe.resonanceHz))
    return { width: L.width, height: L.height }
  },
  frame(i) {
    painter!.frame(i)
  },
  png() {
    return canvas.toDataURL('image/png')
  },
  vtt() {
    const probe = painter ?? new Painter(canvas.getContext('2d')!, 'landscape', [])
    return toVTT(cues(probe.resonanceHz))
  },
}

const q = new URLSearchParams(location.search)
if (q.has('t')) {
  const orientation = (q.get('o') === 'portrait' ? 'portrait' : 'landscape') as Orientation
  void window.film
    .setup({ orientation })
    .then(() => window.film.frame(Math.max(0, Math.min(FRAMES - 1, Math.round(Number(q.get('t')) * FPS)))))
}
