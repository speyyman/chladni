/**
 * A plate driven at one point at one frequency. Each mode responds like a
 * damped oscillator, in proportion to how much it moves at the drive point:
 *
 *   w(x) = Σ_k φ_k(d) φ_k(x) / (Ω_k² − Ω² + 2iζ Ω_k Ω)
 *
 * with φ_k the mass-normalised mode shapes, d the drive point, Ω the drive
 * frequency parameter and ζ the damping ratio. Near a resonance one mode
 * dominates and its nodal lines are sharp; between resonances several modes
 * mix and the still lines blur or vanish. This is standard modal
 * superposition for a lightly damped linear system; the damping value is an
 * assumption, not a measurement.
 */
import { coord, modeField, sample, type Field, type Mode } from './field.js'

export type Plate = {
  modes: Mode[]
  /** Each mode sampled on the same grid. */
  fields: Field[]
}

/** Sample every mode once, so driving the plate is only sums. */
export function preparePlate(modes: Mode[], size: number): Plate {
  return { modes, fields: modes.map((m) => modeField(m, size)) }
}

export type DriveOptions = {
  /** Drive point in plate coordinates. */
  at: { x: number; y: number }
  /** Damping ratio ζ. Default 0.004. */
  damping?: number
  /**
   * Leave out modes whose gain at this frequency is below this fraction of the
   * largest. 0 (the default) keeps every mode; the demo uses 0.01, which keeps
   * the picture and makes a frame several times cheaper.
   */
  prune?: number
}

export type Response = {
  /** Displacement amplitude |w| on the grid. */
  amplitude: Field
  /**
   * Acceleration amplitude Ω²|w|: what sand feels. At exact resonance it is
   * φ_k(d) φ_k(x) / 2ζ whatever the mode, so high modes throw sand as hard as
   * low ones even though they move less.
   */
  acceleration: Field
  /** In-phase and quadrature parts of w. */
  re: Float32Array
  im: Float32Array
  /** The mode contributing most at this frequency. */
  dominant: number
}

export function drive(plate: Plate, omega: number, { at, damping = 0.004, prune = 0 }: DriveOptions): Response {
  const size = plate.fields[0]!.size
  const re = new Float32Array(size * size)
  const im = new Float32Array(size * size)
  const gains = plate.modes.map((mode, k) => {
    const phiD = sample(plate.fields[k]!, at.x, at.y)
    const wk = mode.omega
    const dr = wk * wk - omega * omega
    const di = 2 * damping * wk * omega
    const den = dr * dr + di * di
    // phiD / (dr + i di) = phiD (dr − i di) / den
    return { gr: (phiD * dr) / den, gi: (-phiD * di) / den }
  })
  let best = -1
  let bestGain = 0
  gains.forEach(({ gr, gi }, k) => {
    const g = Math.hypot(gr, gi)
    if (g > bestGain) {
      bestGain = g
      best = k
    }
  })
  gains.forEach(({ gr, gi }, k) => {
    if (Math.hypot(gr, gi) < prune * bestGain) return
    const v = plate.fields[k]!.values
    for (let p = 0; p < v.length; p++) {
      re[p]! += gr * v[p]!
      im[p]! += gi * v[p]!
    }
  })
  const amp = new Float32Array(size * size)
  const acc = new Float32Array(size * size)
  const o2 = omega * omega
  for (let p = 0; p < amp.length; p++) {
    amp[p] = Math.hypot(re[p]!, im[p]!)
    acc[p] = amp[p]! * o2
  }
  return { amplitude: { size, values: amp }, acceleration: { size, values: acc }, re, im, dominant: best }
}

/** The largest acceleration on the plate when mode k is driven at exact resonance. */
export function resonantPeak(plate: Plate, k: number, opts: DriveOptions): number {
  const { acceleration } = drive(plate, plate.modes[k]!.omega, opts)
  let max = 0
  for (const v of acceleration.values) max = Math.max(max, v)
  return max
}

/**
 * A fixed acceleration scale for sand: the median of the resonant peaks of all
 * modes. Against it, a plate driven at a resonance throws sand hard and a
 * plate driven between resonances barely at all, as with a real plate and a
 * drive of fixed strength.
 */
export function referenceAcceleration(plate: Plate, opts: DriveOptions): number {
  const peaks = plate.modes.map((_, k) => resonantPeak(plate, k, opts)).sort((a, b) => a - b)
  return peaks[peaks.length >> 1]!
}

/** Where on the grid each sample lies, for callers that draw fields. */
export const gridCoord = coord
