/**
 * A plate on a bench: modes, a drive at one point and one frequency, and sand.
 * The demo, the essay figures and the film all drive the same object.
 */
import { circleModes } from './circle.js'
import { drive, preparePlate, referenceAcceleration, type Plate } from './drive.js'
import { nodalLines, type Field, type Mode, type PlateShape } from './field.js'
import { DEMO_DISC, DEMO_SQUARE, hertz, omegaFor, type PhysicalPlate } from './plate.js'
import { Sand } from './sand.js'
import { squareModes } from './square.js'

export type Resonance = {
  index: number
  hz: number
  omega: number
  /** Square: symmetry about x, y and the diagonal (S/A); circle: n nodal diameters, s nodal circles. */
  label: string
}

export type BenchOptions = {
  shape?: PlateShape
  /** Physical plate for the hertz figures. Defaults: 24 cm square or 24 cm disc of 1 mm steel. */
  physical?: PhysicalPlate
  /** Grid size for fields. Default 128. */
  size?: number
  grains?: number
  seed?: number
  /** Highest frequency of interest; modes above it are left out. Default 1600 Hz. */
  maxHz?: number
  /** Drive point in plate coordinates. Default near the edge, where a bow would touch. */
  at?: { x: number; y: number }
  damping?: number
  /** See DriveOptions.prune. Default 0.01. */
  prune?: number
}

export const labelFor = (m: Mode) =>
  m.plate === 'square' ? `${m.symmetry.x}${m.symmetry.y}${m.symmetry.diagonal === '-' ? '' : m.symmetry.diagonal}` : `${m.n},${m.s}`

export class Bench {
  readonly shape: PlateShape
  readonly physical: PhysicalPlate
  readonly plate: Plate
  sand: Sand
  readonly resonances: Resonance[]
  private opts: { at: { x: number; y: number }; damping: number; prune: number }
  private reference: number
  hz = 0
  acceleration: Field
  /** The plate's displacement in the phase that carries most of the motion: its zero set is the nodal lines. */
  shapeField: Field
  dominant = 0

  constructor({
    shape = 'square',
    physical,
    size = 128,
    grains = 20000,
    seed = 1,
    maxHz = 1600,
    at = { x: 0.83, y: 0.31 },
    damping = 0.004,
    prune = 0.01,
  }: BenchOptions = {}) {
    this.shape = shape
    this.physical = physical ?? (shape === 'square' ? DEMO_SQUARE : DEMO_DISC)
    const maxOmega = omegaFor(maxHz, this.physical)
    const modes: Mode[] =
      shape === 'square'
        ? squareModes({ terms: 16 }).filter((m) => m.omega <= maxOmega)
        : circleModes({ maxN: 14, maxLambda: Math.sqrt(maxOmega) + 0.3 }).filter((m) => m.omega <= maxOmega)
    this.plate = preparePlate(modes, size)
    this.resonances = modes.map((m, index) => ({ index, hz: hertz(m.omega, this.physical), omega: m.omega, label: labelFor(m) }))
    this.sand = new Sand({ count: grains, seed, plate: shape })
    this.opts = { at: shape === 'circle' && Math.hypot(at.x, at.y) > 0.95 ? { x: 0.7, y: 0.25 } : at, damping, prune }
    this.reference = referenceAcceleration(this.plate, this.opts)
    this.acceleration = { size, values: new Float32Array(size * size) }
    this.shapeField = { size, values: new Float32Array(size * size) }
    this.setHz(this.resonances[0]?.hz ?? 100)
  }

  get drivePoint() {
    return this.opts.at
  }

  /** Move the drive point (plate coordinates). */
  setDrive(at: { x: number; y: number }) {
    this.opts = { ...this.opts, at }
    this.reference = referenceAcceleration(this.plate, this.opts)
    this.setHz(this.hz)
  }

  setHz(hz: number) {
    this.hz = hz
    const r = drive(this.plate, omegaFor(hz, this.physical), this.opts)
    this.acceleration = r.acceleration
    this.dominant = r.dominant
    let re = 0
    let im = 0
    for (let i = 0; i < r.re.length; i++) {
      re += r.re[i]! ** 2
      im += r.im[i]! ** 2
    }
    this.shapeField = { size: r.amplitude.size, values: re > im ? r.re : r.im }
  }

  /** Peak acceleration now, relative to a typical resonance: under about 0.05 the sand stays put. */
  get strength() {
    let max = 0
    for (const v of this.acceleration.values) max = Math.max(max, v)
    return max / this.reference
  }

  /** Replace the sand with a fresh, evenly spread set of `count` grains. */
  setGrains(count: number, seed = 1) {
    this.sand = new Sand({ count, seed, plate: this.shape })
  }

  /** Move the sand `steps` times at the current frequency. Returns grains moved in the last step. */
  step(steps = 1) {
    let moved = 0
    for (let i = 0; i < steps; i++) moved = this.sand.step(this.acceleration, { scale: this.reference })
    return moved
  }

  /** The nodal lines of the current motion, as segments in plate coordinates. */
  nodalLines() {
    return nodalLines(this.shapeField, this.shape)
  }

  /** The resonance nearest to a frequency (by ratio). */
  nearest(hz: number): Resonance | undefined {
    let best: Resonance | undefined
    for (const r of this.resonances) if (!best || Math.abs(Math.log(r.hz / hz)) < Math.abs(Math.log(best.hz / hz))) best = r
    return best
  }
}
