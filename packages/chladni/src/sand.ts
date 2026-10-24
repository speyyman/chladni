/**
 * Sand on a vibrating plate. Where the plate moves hard, grains are thrown up
 * and land somewhere a little different; where it does not move, they stay.
 * So grains random-walk with a step that grows with the local amplitude, and
 * collect where the amplitude is zero: the nodal lines. Below a threshold the
 * plate cannot throw a grain at all, which is why a plate driven between
 * resonances leaves the last pattern in place.
 *
 * This is a deliberately simple model of the mechanism Chladni and Faraday
 * describe (heavy grains go to the nodal lines). It leaves out bouncing
 * dynamics, friction, air currents (which carry very light powder to the
 * antinodes instead, as Faraday showed in 1831) and grains falling off the
 * edge.
 */
import { isInside, sample, type Field, type PlateShape } from './field.js'

/** Mulberry32: a small seeded generator, so a run of sand is repeatable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type SandOptions = {
  /** Number of grains. Default 20,000. */
  count?: number
  seed?: number
  plate?: PlateShape
}

export type StepOptions = {
  /** Acceleration below which a grain is not thrown, as a fraction of `scale` (the plate must out-accelerate gravity). Default 0.05. */
  threshold?: number
  /** Acceleration that counts as a full-strength throw. */
  scale: number
  /** Jump length, in plate units, for a grain at full strength. Default 0.04. */
  jump?: number
}

export class Sand {
  readonly x: Float32Array
  readonly y: Float32Array
  readonly plate: PlateShape
  private readonly rand: () => number

  constructor({ count = 20000, seed = 1, plate = 'square' }: SandOptions = {}) {
    this.x = new Float32Array(count)
    this.y = new Float32Array(count)
    this.plate = plate
    this.rand = mulberry32(seed)
    this.scatter()
  }

  get count() {
    return this.x.length
  }

  /** Spread the grains evenly at random over the plate. */
  scatter() {
    for (let i = 0; i < this.count; i++) {
      let x: number
      let y: number
      do {
        x = this.rand() * 2 - 1
        y = this.rand() * 2 - 1
      } while (!isInside(this.plate, x, y))
      this.x[i] = x
      this.y[i] = y
    }
  }

  /** A standard normal deviate (Box–Muller). */
  private gauss() {
    const u = Math.max(1e-12, this.rand())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rand())
  }

  /**
   * Move every grain once, given the plate's acceleration field. A thrown grain
   * lands a random distance away that grows with the local acceleration, so
   * grains wander out of busy regions and stop where the plate is still.
   * Returns how many moved.
   */
  step(acceleration: Field, { threshold = 0.05, scale, jump = 0.04 }: StepOptions): number {
    let moved = 0
    const { size, values } = acceleration
    const half = size / 2
    const inv = 1 / scale
    for (let i = 0; i < this.count; i++) {
      const x = this.x[i]!
      const y = this.y[i]!
      // Bilinear lookup, inlined: this loop runs for every grain on every frame.
      let fx = (x + 1) * half - 0.5
      let fy = (y + 1) * half - 0.5
      fx = fx < 0 ? 0 : fx > size - 1.000001 ? size - 1.000001 : fx
      fy = fy < 0 ? 0 : fy > size - 1.000001 ? size - 1.000001 : fy
      const ix = fx | 0
      const iy = fy | 0
      const u = fx - ix
      const v = fy - iy
      const o = iy * size + ix
      const a =
        ((values[o]! * (1 - u) + values[o + 1]! * u) * (1 - v) + (values[o + size]! * (1 - u) + values[o + size + 1]! * u) * v) * inv
      if (a <= threshold) continue
      // √a rather than a: grains near a node still settle in reasonable time, and the walk's
      // stationary density, which goes as 1/a, still piles them onto the zero lines.
      const s = jump * Math.sqrt(Math.min(1, a))
      let nx = x + s * this.gauss()
      let ny = y + s * this.gauss()
      // Keep grains on the plate: reflect off the edge.
      if (this.plate === 'square') {
        if (nx > 1) nx = 2 - nx
        if (nx < -1) nx = -2 - nx
        if (ny > 1) ny = 2 - ny
        if (ny < -1) ny = -2 - ny
      } else {
        const r = Math.hypot(nx, ny)
        if (r > 1) {
          const k = (2 - r) / r
          nx *= k
          ny *= k
        }
      }
      this.x[i] = nx
      this.y[i] = ny
      moved++
    }
    return moved
  }

  /** Mean of a field under the grains, relative to `scale`: near zero once they sit on nodal lines. */
  meanUnder(field: Field, scale: number): number {
    let s = 0
    for (let i = 0; i < this.count; i++) s += sample(field, this.x[i]!, this.y[i]!)
    return s / this.count / scale
  }
}
