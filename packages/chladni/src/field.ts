/**
 * Mode shapes sampled on a grid, and the nodal lines in them.
 *
 * A field covers −1 ≤ x, y ≤ 1 with `size × size` samples at cell centres,
 * row-major, y downwards in the array (row 0 is y = −1). For the circular
 * plate, samples outside the unit disc are 0 and `inside` says which are real.
 */
import { circleRadial, type CircleMode } from './circle.js'
import { legendre, type SquareMode } from './square.js'

export type Mode = SquareMode | CircleMode
export type PlateShape = Mode['plate']

export type Field = {
  size: number
  values: Float32Array
}

/** Plate coordinate of grid index i (cell centre). */
export const coord = (i: number, size: number) => -1 + (2 * (i + 0.5)) / size

export const isInside = (plate: PlateShape, x: number, y: number) => plate === 'square' || x * x + y * y <= 1

/** Sample a mode on a grid. Square modes are mass-normalised on the square, circle modes on the disc. */
export function modeField(mode: Mode, size: number): Field {
  const values = new Float32Array(size * size)
  if (mode.plate === 'square') {
    const N = mode.terms
    const q: Float64Array[] = []
    for (let i = 0; i < size; i++) q.push(legendre(N, coord(i, size)).q)
    // w(x, y) = Σ_j q_j(y) Σ_i c_ij q_i(x): first the inner sums for every x.
    const inner = new Float64Array(size * N)
    for (let xi = 0; xi < size; xi++)
      for (let j = 0; j < N; j++) {
        let s = 0
        for (let i = 0; i < N; i++) s += mode.coefficients[i * N + j]! * q[xi]![i]!
        inner[xi * N + j] = s
      }
    for (let yi = 0; yi < size; yi++)
      for (let xi = 0; xi < size; xi++) {
        let s = 0
        for (let j = 0; j < N; j++) s += inner[xi * N + j]! * q[yi]![j]!
        values[yi * size + xi] = s
      }
    return { size, values }
  }
  // Circle: a fine table of the radial function, then cos nθ.
  const R = 2048
  const radial = new Float64Array(R + 1)
  for (let k = 0; k <= R; k++) radial[k] = circleRadial(mode, k / R) * mode.norm
  for (let yi = 0; yi < size; yi++)
    for (let xi = 0; xi < size; xi++) {
      const x = coord(xi, size)
      const y = coord(yi, size)
      const r = Math.hypot(x, y)
      if (r > 1) continue
      const t = r * R
      const k = Math.min(R - 1, Math.floor(t))
      const f = t - k
      values[yi * size + xi] = (radial[k]! * (1 - f) + radial[k + 1]! * f) * Math.cos(mode.n * Math.atan2(y, x))
    }
  return { size, values }
}

/** Bilinear sample of a field at plate coordinates (x, y). */
export function sample(field: Field, x: number, y: number): number {
  const { size, values } = field
  const fx = Math.min(size - 1.000001, Math.max(0, ((x + 1) / 2) * size - 0.5))
  const fy = Math.min(size - 1.000001, Math.max(0, ((y + 1) / 2) * size - 0.5))
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const u = fx - i
  const v = fy - j
  const a = values[j * size + i]!
  const b = values[j * size + i + 1]!
  const c = values[(j + 1) * size + i]!
  const d = values[(j + 1) * size + i + 1]!
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

/**
 * Nodal lines by marching squares on the zero level: segments as flat
 * [x1, y1, x2, y2, ...] in plate coordinates. On the circular plate, cells that
 * reach outside the disc are skipped.
 */
export function nodalLines(field: Field, plate: PlateShape = 'square'): Float32Array {
  const { size, values } = field
  const out: number[] = []
  const at = (i: number, j: number) => values[j * size + i]!
  const lerp = (a: number, b: number) => a / (a - b)
  for (let j = 0; j < size - 1; j++) {
    for (let i = 0; i < size - 1; i++) {
      const x0 = coord(i, size)
      const y0 = coord(j, size)
      const x1 = coord(i + 1, size)
      const y1 = coord(j + 1, size)
      if (plate === 'circle' && !(isInside(plate, x0, y0) && isInside(plate, x1, y0) && isInside(plate, x0, y1) && isInside(plate, x1, y1)))
        continue
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i + 1, j + 1)
      const d = at(i, j + 1)
      // Crossing points on the four edges, in order: top, right, bottom, left.
      const pts: number[] = []
      if (a < 0 !== b < 0) pts.push(x0 + (x1 - x0) * lerp(a, b), y0)
      if (b < 0 !== c < 0) pts.push(x1, y0 + (y1 - y0) * lerp(b, c))
      if (d < 0 !== c < 0) pts.push(x0 + (x1 - x0) * lerp(d, c), y1)
      if (a < 0 !== d < 0) pts.push(x0, y0 + (y1 - y0) * lerp(a, d))
      if (pts.length === 4) out.push(...pts)
      else if (pts.length === 8) {
        // Saddle: decide the pairing by the centre value.
        const centre = (a + b + c + d) / 4
        if (centre < 0 === a < 0) out.push(pts[0]!, pts[1]!, pts[2]!, pts[3]!, pts[4]!, pts[5]!, pts[6]!, pts[7]!)
        else out.push(pts[0]!, pts[1]!, pts[6]!, pts[7]!, pts[2]!, pts[3]!, pts[4]!, pts[5]!)
      }
    }
  }
  return Float32Array.from(out)
}
