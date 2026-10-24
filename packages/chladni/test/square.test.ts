import { describe, expect, it } from 'vitest'
import { modeField, nodalLines } from '../src/field.js'
import { membraneModeAt, squareModeAt, squareModes, type SquareMode } from '../src/square.js'

const label = (m: SquareMode) => `${m.symmetry.x}${m.symmetry.y}${m.symmetry.diagonal}`

describe('free square plate (Rayleigh–Ritz)', () => {
  const modes = squareModes({ nu: 0.3, terms: 14 })

  it('matches Narita (2022), table 17, a/b = 1, ν = 0.3, to five significant figures', () => {
    // Y. Narita, EPI International Journal of Engineering 5 (2022) 26–36, doi:10.25042/epi-ije.022022.05.
    const narita = [13.468, 19.596, 24.27, 34.801, 34.801, 61.093]
    narita.forEach((v, k) => expect(Number(modes[k]!.omega.toPrecision(5))).toBe(v))
  })

  it('matches Narita (2022) for ν = 0.333 too', () => {
    const third = squareModes({ nu: 0.333, terms: 14 })
    ;[13.169, 19.224, 24.423, 34.233].forEach((v, k) => expect(Number(third[k]!.omega.toPrecision(5))).toBe(v))
  })

  it('matches Leissa (1969), table 4.65, for the doubly symmetric modes', () => {
    // A. W. Leissa, Vibration of Plates, NASA SP-160, table 4.65 (after ref. 4.113): modes symmetric about
    // both centre lines and both diagonals, and modes symmetric about the centre lines, antisymmetric about the diagonals.
    const sss = modes.filter((m) => label(m) === 'SSS').map((m) => m.omega)
    ;[24.2702, 63.687, 122.4449, 168.4888].forEach((v, k) => expect(Math.abs(sss[k]! / v - 1)).toBeLessThan(1e-4))
    const ssa = modes.filter((m) => label(m) === 'SSA').map((m) => m.omega)
    expect(Math.abs(ssa[0]! / 19.5961 - 1)).toBeLessThan(1e-4)
    // Leissa's table 4.65 also lists 65.368 in this class; this converged solver finds no mode near it (see README).
    expect(ssa.slice(1, 3).map((v) => Math.abs(v / 117.1093 - 1) < 1e-4 || Math.abs(v / 161.5049 - 1) < 1e-4)).toEqual([true, true])
  })

  it('stays within Leissa’s bounds (table 4.67) for the twisting modes', () => {
    // Antisymmetric about the centre lines, symmetric about the diagonals, ν = 0.3: lower bounds and
    // the 50-term beam-function upper bounds of ref. 4.118.
    const aas = modes.filter((m) => label(m) === 'AAS').map((m) => m.omega)
    const bounds: [number, number][] = [
      [13.201, 13.473],
      [75.735, 77.354],
      [147.71, 153.07],
      [209.46, 214.62],
    ]
    bounds.forEach(([lo, hi], k) => {
      expect(aas[k]!).toBeGreaterThan(lo)
      expect(aas[k]!).toBeLessThan(hi)
    })
  })

  it('lies inside Leissa’s bounds for the doubly antisymmetric modes (table 4.75, b/a = 1, ν = 0.3)', () => {
    // These bounds also rule out table 4.65's entry at 173.695: mode 4 is at most 153.12 and mode 5 at least 196.46.
    const aa = modes.filter((m) => m.symmetry.x === 'A' && m.symmetry.y === 'A').map((m) => m.omega)
    const bounds: [number, number][] = [
      [13.092, 13.474],
      [66.508, 69.576],
      [75.146, 77.411],
      [145.57, 153.12],
      [196.46, 205.17],
    ]
    bounds.forEach(([lo, hi], k) => {
      expect(aa[k]!).toBeGreaterThan(lo)
      expect(aa[k]!).toBeLessThan(hi)
    })
  })

  it('is converged for every mode the demo shows: 16 and 22 terms agree to 1 part in 50,000 below Ω = 380', () => {
    const fine = squareModes({ terms: 22 })
    const shown = squareModes({ terms: 16 }).filter((m) => m.omega < 380)
    expect(shown.length).toBe(38)
    shown.forEach((m, k) => expect(Math.abs(m.omega / fine[k]!.omega - 1)).toBeLessThan(2e-5))
  }, 60000)

  it('converges from above as terms are added (Ritz values are upper bounds)', () => {
    const coarse = squareModes({ terms: 8 })
    for (let k = 0; k < 8; k++) expect(coarse[k]!.omega).toBeGreaterThanOrEqual(modes[k]!.omega - 1e-9)
  })

  it('has degenerate pairs where symmetry demands it', () => {
    const pairs = modes.filter((m) => m.symmetry.diagonal === '-')
    for (let k = 0; k + 1 < 8; k += 2) expect(pairs[k]!.omega).toBeCloseTo(pairs[k + 1]!.omega, 8)
  })
})

describe('nodal lines', () => {
  const modes = squareModes({ terms: 14 })
  const size = 161
  const near = (segs: Float32Array, onLine: (x: number, y: number) => number, tol: number) => {
    let worst = 0
    for (let i = 0; i < segs.length; i += 2) worst = Math.max(worst, onLine(segs[i]!, segs[i + 1]!))
    return worst < tol
  }

  it('the twisting mode (Ω ≈ 13.47) is still along both centre lines, and nowhere else', () => {
    const lines = nodalLines(modeField(modes[0]!, size))
    expect(lines.length).toBeGreaterThan(0)
    expect(near(lines, (x, y) => Math.min(Math.abs(x), Math.abs(y)), 0.02)).toBe(true)
  })

  it('the saddle mode (Ω ≈ 19.60) is still along both diagonals', () => {
    const lines = nodalLines(modeField(modes[1]!, size))
    expect(near(lines, (x, y) => Math.abs(Math.abs(x) - Math.abs(y)) / Math.SQRT2, 0.02)).toBe(true)
  })

  it('the ring mode (Ω ≈ 24.27) has a closed nodal curve that crosses each centre line twice', () => {
    const f = modeField(modes[2]!, size)
    const c = (size - 1) / 2
    let crossings = 0
    for (let i = 1; i < size; i++) if (f.values[c * size + i - 1]! < 0 !== f.values[c * size + i]! < 0) crossings++
    expect(crossings).toBe(2)
  })

  it('find the analytic nodal lines of membrane modes cos mπx cos nπy ± cos nπx cos mπy', () => {
    // (m, n) = (2, 0), minus sign: cos 2πu − cos 2πv = 0 exactly on both diagonals.
    // (m, n) = (1, 0), plus sign: cos πu + cos πv = 0 exactly on the anti-diagonal u + v = 1, i.e. y = −x.
    // (m, n) = (3, 1), minus sign: zero on the diagonal y = x (and elsewhere).
    const field = (m: number, n: number, s: 1 | -1) => {
      const values = new Float32Array(size * size)
      for (let j = 0; j < size; j++)
        for (let i = 0; i < size; i++)
          values[j * size + i] = membraneModeAt(m, n, s, -1 + (2 * (i + 0.5)) / size, -1 + (2 * (j + 0.5)) / size)
      return { size, values }
    }
    expect(near(nodalLines(field(2, 0, -1)), (x, y) => Math.abs(Math.abs(x) - Math.abs(y)) / Math.SQRT2, 0.005)).toBe(true)
    expect(near(nodalLines(field(1, 0, 1)), (x, y) => Math.abs(x + y) / Math.SQRT2, 0.005)).toBe(true)
    const diag = nodalLines(field(3, 1, -1))
    let onDiagonal = 0
    for (let i = 0; i < diag.length; i += 2) if (Math.abs(diag[i]! - diag[i + 1]!) < 0.01) onDiagonal++
    expect(onDiagonal).toBeGreaterThan(size)
  })

  it('evaluate the same at a point as on the grid', () => {
    const f = modeField(modes[3]!, size)
    const i = 37
    const j = 101
    const x = -1 + (2 * (i + 0.5)) / size
    const y = -1 + (2 * (j + 0.5)) / size
    expect(f.values[j * size + i]).toBeCloseTo(squareModeAt(modes[3]!, x, y), 5)
  })
})
