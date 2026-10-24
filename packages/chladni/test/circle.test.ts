import { describe, expect, it } from 'vitest'
import { circleModeAt, circleModes, nodalCircles } from '../src/circle.js'
import { modeField, nodalLines } from '../src/field.js'

// A. W. Leissa, Vibration of Plates, NASA SP-160 (1969): table 2.5, λ² = ωa²√(ρh/D) for a completely free
// circular plate with ν = 0.33, and table 2.7, radii of its nodal circles. Entries the table marks as
// true only within 2 percent are left out.
const LEISSA_2_5: [n: number, s: number, omega: number][] = [
  [2, 0, 5.253],
  [3, 0, 12.23],
  [0, 1, 9.084],
  [1, 1, 20.52],
  [2, 1, 35.25],
  [3, 1, 52.91],
  [0, 2, 38.55],
  [1, 2, 59.86],
]
const LEISSA_2_7: [n: number, s: number, radii: number[]][] = [
  [0, 1, [0.68]],
  [1, 1, [0.781]],
  [2, 1, [0.822]],
  [3, 1, [0.847]],
  [0, 2, [0.391, 0.841]],
  [1, 2, [0.497, 0.871]],
]

describe('free circular plate', () => {
  const modes = circleModes({ nu: 0.33, maxN: 6, maxLambda: 12 })
  const find = (n: number, s: number) => modes.find((m) => m.n === n && m.s === s)!

  it('matches Leissa table 2.5 within 0.5%', () => {
    for (const [n, s, omega] of LEISSA_2_5) expect(Math.abs(find(n, s).omega / omega - 1)).toBeLessThan(0.005)
  })

  it('matches the nodal-circle radii of Leissa table 2.7 within 0.005', () => {
    for (const [n, s, radii] of LEISSA_2_7) nodalCircles(find(n, s)).forEach((r, i) => expect(Math.abs(r - radii[i]!)).toBeLessThan(0.005))
  })

  it('satisfies the free-edge conditions: no bending moment at the rim', () => {
    // M_r ∝ w_rr + ν (w_r / r − n² w / r²) at r = 1, by finite differences on the mode shape.
    const nu = 0.33
    for (const m of modes.slice(0, 6)) {
      const h = 1e-4
      const R = (r: number) => circleModeAt(m, r, 0)
      const w = R(1 - h)
      const wr = (R(1) - R(1 - 2 * h)) / (2 * h)
      const wrr = (R(1) - 2 * R(1 - h) + R(1 - 2 * h)) / (h * h)
      const moment = wrr + nu * (wr - m.n * m.n * w)
      expect(Math.abs(moment)).toBeLessThan(0.01 * Math.max(1, Math.abs(wrr)))
    }
  })

  it('draws nodal diameters where cos nθ = 0 and nodal circles at the computed radii', () => {
    const size = 201
    const two = modeField(find(2, 0), size)
    const segs = nodalLines(two, 'circle')
    expect(segs.length).toBeGreaterThan(0)
    for (let i = 0; i < segs.length; i += 2) {
      // Every diameter passes through the centre, where the direction is undefined; skip that cell.
      if (Math.hypot(segs[i]!, segs[i + 1]!) < 0.03) continue
      const t = Math.atan2(segs[i + 1]!, segs[i]!)
      expect(Math.abs(Math.cos(2 * t))).toBeLessThan(0.05)
    }
    const ring = nodalLines(modeField(find(0, 1), size), 'circle')
    const r0 = nodalCircles(find(0, 1))[0]!
    for (let i = 0; i < ring.length; i += 2) expect(Math.abs(Math.hypot(ring[i]!, ring[i + 1]!) - r0)).toBeLessThan(0.01)
  })

  it('normalises every mode to unit mean square over the disc', () => {
    const size = 201
    for (const m of modes.slice(0, 5)) {
      const f = modeField(m, size)
      let s = 0
      for (const v of f.values) s += v * v
      expect(s * (2 / size) ** 2).toBeCloseTo(1, 1)
    }
  })
})
