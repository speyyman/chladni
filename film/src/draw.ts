/**
 * Paints one frame: the plate with its sand, the plate label and a readout of
 * the drive, and the caption. The sand is a simulation, so frames depend on
 * the frames before them; each plate's part starts from freshly scattered
 * grains with a fixed seed, so any frame can be rebuilt by replaying from the
 * start of its part.
 */
import { Bench } from 'chladni'
import { FPS, cueAt, momentAt, type Cue } from './script.js'

/** The site's colours (speyyman.github.io, "Herbarium"). */
export const COLORS = { ink: '#0c1611', forest: '#142a1f', moss: '#4f7a5a', bone: '#ece4d0', vermilion: '#ff6b3d' } as const

const DISPLAY = '"Big Shoulders Display"'
const MONO = '"Geist Mono"'
export const GRAINS = 24000
/** Sand steps per frame. */
export const STEPS = 3
const SEED = { square: 11, circle: 23 }

export type Orientation = 'landscape' | 'portrait'
type Box = { x: number; y: number; w: number; h: number }
export type Layout = {
  width: number
  height: number
  plate: Box
  label: { x: number; y: number }
  title: { x: number; y: number; size: number }
  readout: { x: number; y: number }
  caption: Box & { size: number }
}

export function layoutFor(o: Orientation): Layout {
  const side = 944
  if (o === 'landscape')
    return {
      width: 1920,
      height: 1080,
      plate: { x: 1920 - 96 - side, y: (1080 - side) / 2, w: side, h: side },
      label: { x: 96, y: 128 },
      title: { x: 96, y: 290, size: 148 },
      readout: { x: 96, y: 380 },
      caption: { x: 96, y: 720, w: 720, h: 260, size: 32 },
    }
  return {
    width: 1080,
    height: 1920,
    plate: { x: (1080 - side) / 2, y: 200, w: side, h: side },
    label: { x: (1080 - side) / 2, y: 160 },
    title: { x: (1080 - side) / 2, y: 1300, size: 132 },
    readout: { x: (1080 - side) / 2, y: 1360 },
    caption: { x: (1080 - side) / 2, y: 1660, w: side, h: 220, size: 34 },
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export class Painter {
  readonly layout: Layout
  readonly benches: { square: Bench; circle: Bench }
  /** The last frame simulated, or −1. */
  private cursor = -1
  private readonly orientation: Orientation

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    orientation: Orientation,
    private readonly cues: readonly Cue[],
  ) {
    this.orientation = orientation
    this.layout = layoutFor(orientation)
    this.benches = {
      square: new Bench({ shape: 'square', grains: GRAINS, seed: SEED.square }),
      circle: new Bench({ shape: 'circle', grains: GRAINS, seed: SEED.circle }),
    }
  }

  get resonanceHz() {
    return { square: this.benches.square.resonances.map((r) => r.hz), circle: this.benches.circle.resonances.map((r) => r.hz) }
  }

  /** Advance the simulation through frame i (frames must come in order). */
  private simulate(i: number) {
    const m = momentAt(i / FPS, this.resonanceHz)
    if (m.scene !== 'plate') return
    const bench = this.benches[m.plate]
    // A part's first frame: fresh sand, the same every time.
    if (Math.floor(m.part.start * FPS) === i || Math.ceil(m.part.start * FPS) === i) bench.setGrains(GRAINS, SEED[m.plate])
    if (bench.hz !== m.hz) bench.setHz(m.hz)
    bench.step(STEPS)
  }

  /** First frame of the part that frame i belongs to (or i itself outside the plates). */
  private partStart(i: number) {
    const m = momentAt(i / FPS, this.resonanceHz)
    return m.scene === 'plate' ? Math.ceil(m.part.start * FPS) : i
  }

  frame(i: number) {
    // Rebuild the sand if asked for a frame behind the simulation or in another part.
    const start = this.partStart(i)
    if (i <= this.cursor || this.cursor < start - 1) this.cursor = start - 1
    while (this.cursor < i) this.simulate(++this.cursor)
    this.paint(i)
  }

  private paint(i: number) {
    const t = i / FPS
    const { ctx, layout: L } = this
    ctx.save()
    ctx.fillStyle = COLORS.ink
    ctx.fillRect(0, 0, L.width, L.height)
    const m = momentAt(t, this.resonanceHz)
    const land = this.orientation === 'landscape'
    const x0 = land ? 96 : 68
    if (m.scene === 'title') {
      ctx.globalAlpha = Math.min(1, t / 0.6, (5 - t) / 0.4)
      ctx.fillStyle = COLORS.bone
      ctx.font = `300 ${land ? 190 : 150}px ${DISPLAY}`
      if (land) ctx.fillText('Sound, made visible', x0, 480)
      else {
        ctx.fillText('Sound,', x0, 760)
        ctx.fillText('made visible', x0, 910)
      }
      ctx.globalAlpha *= 0.7
      ctx.font = `400 26px ${MONO}`
      ctx.fillText('SAND ON A STEEL PLATE  ·  CHLADNI FIGURES', x0, land ? 560 : 990)
    } else if (m.scene === 'end') {
      ctx.globalAlpha = 0.7
      ctx.fillStyle = COLORS.bone
      ctx.font = `400 26px ${MONO}`
      ctx.fillText('SPEYYMAN.GITHUB.IO', x0, land ? 980 : 1780)
      ctx.fillText('CC BY 4.0', x0, land ? 1020 : 1820)
    } else if (m.scene === 'plate') this.plateFrame(m)
    ctx.globalAlpha = 1
    this.caption(t)
    ctx.restore()
  }

  private plateFrame(m: Extract<ReturnType<typeof momentAt>, { scene: 'plate' }>) {
    const { ctx, layout: L } = this
    const bench = this.benches[m.plate]
    const P = L.plate
    const toPx = (x: number, y: number) => ({ x: P.x + ((x + 1) / 2) * P.w, y: P.y + ((y + 1) / 2) * P.h })

    // The plate.
    ctx.fillStyle = COLORS.forest
    ctx.strokeStyle = 'rgba(236, 228, 208, 0.35)'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (m.plate === 'square') ctx.rect(P.x, P.y, P.w, P.h)
    else ctx.arc(P.x + P.w / 2, P.y + P.h / 2, P.w / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // The sand: one 2 px grain each.
    ctx.fillStyle = COLORS.bone
    const { x: gx, y: gy } = bench.sand
    for (let k = 0; k < gx.length; k++) {
      const p = toPx(gx[k]!, gy[k]!)
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2)
    }

    // The drive point.
    const d = toPx(bench.drivePoint.x, bench.drivePoint.y)
    ctx.strokeStyle = COLORS.vermilion
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(d.x, d.y, 12, 0, Math.PI * 2)
    ctx.stroke()

    // Label, name and readout.
    const name = m.plate === 'square' ? 'Square' : 'Disc'
    ctx.fillStyle = COLORS.bone
    ctx.globalAlpha = 0.7
    ctx.font = `400 24px ${MONO}`
    ctx.fillText(`${m.plate === 'square' ? 'PLATE I' : 'PLATE II'}  ·  ${name.toUpperCase()}, STEEL, 24 CM`, L.label.x, L.label.y)
    ctx.globalAlpha = 1
    ctx.font = `300 ${L.title.size}px ${DISPLAY}`
    ctx.fillText(name, L.title.x, L.title.y)

    const strength = bench.strength
    const near = bench.nearest(m.hz)!
    const rows: { text: string; accent?: boolean; dim?: boolean }[] = [
      { text: `frequency  ${(m.hz < 100 ? m.hz.toFixed(1) : m.hz.toFixed(0)).padStart(6)} Hz`, accent: m.holding },
      {
        text: `mode       ${m.holding ? (m.plate === 'square' ? `Ω ${near.omega.toFixed(2)}` : `n ${near.label.split(',')[0]}, s ${near.label.split(',')[1]}`) : '–'}`,
      },
      { text: `motion     ${strength < 0.05 ? 'too weak to throw sand' : strength.toFixed(2)}`, dim: strength < 0.05 },
    ]
    ctx.font = `400 26px ${MONO}`
    rows.forEach((r, k) => {
      ctx.fillStyle = r.accent ? COLORS.vermilion : COLORS.bone
      ctx.globalAlpha = r.dim ? 0.55 : 1
      ctx.fillText(r.text, L.readout.x, L.readout.y + 48 + k * 26 * 1.6)
    })
    ctx.globalAlpha = 1
  }

  private caption(t: number) {
    const cue = cueAt(this.cues, t)
    if (!cue) return
    const { ctx, layout: L } = this
    ctx.globalAlpha = Math.min(1, (t - cue.start) / 0.25, (cue.end - t) / 0.25)
    ctx.font = `400 ${L.caption.size}px ${MONO}`
    const box = L.caption
    const lines = wrap(ctx, cue.text, box.w)
    ctx.fillStyle = COLORS.vermilion
    ctx.fillRect(box.x, box.y - 6, 48, 4)
    ctx.fillStyle = COLORS.bone
    lines.forEach((line, k) => ctx.fillText(line, box.x, box.y + 48 + k * box.size * 1.5))
    ctx.globalAlpha = 1
  }
}
