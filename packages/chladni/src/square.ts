/**
 * Free vibration of a thin square plate with all four edges free: the plate
 * Chladni bowed. Kirchhoff plate theory, solved by the Rayleigh–Ritz method.
 *
 * The deflection is written as w(x, y) = Σ c_ij q_i(x) q_j(y) on −1 ≤ x, y ≤ 1,
 * where q_i are orthonormal Legendre polynomials. Free edges need no boundary
 * conditions on the trial functions (they are natural conditions), so any
 * complete set will do; polynomials converge fast for the low modes.
 * Minimising the Rayleigh quotient of
 *
 *   U = ∫∫ w_xx² + w_yy² + 2ν w_xx w_yy + 2(1 − ν) w_xy² dA   (bending energy × 2/D)
 *   T = ∫∫ w² dA                                               (kinetic energy × 2/(ρhω²))
 *
 * gives K c = μ c with μ = ω² ρh / D in these units. Leissa's frequency
 * parameter for a square of side a is Ω = ω a² √(ρh/D); here a = 2, so Ω = 4√μ.
 *
 * The problem splits by the parity of i and j (symmetry about the two centre
 * lines), so each block is solved on its own. Ritz values are upper bounds and
 * converge from above as terms are added.
 *
 * References: W. Ritz, Annalen der Physik 333 (1909) 737–786, who solved this
 * very problem to introduce the method; A. W. Leissa, Vibration of Plates,
 * NASA SP-160 (1969), tables 4.65 and 4.67, which the tests compare against.
 */
import { symmetricEigen, matrix } from './linalg.js'

/** Gauss–Legendre nodes and weights on [−1, 1]. */
export function gaussLegendre(n: number): { x: Float64Array; w: Float64Array } {
  const x = new Float64Array(n)
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // Chebyshev-like first guess, then Newton on P_n.
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5))
    for (let it = 0; it < 100; it++) {
      let p0 = 1
      let p1 = z
      for (let k = 2; k <= n; k++) [p0, p1] = [p1, ((2 * k - 1) * z * p1 - (k - 1) * p0) / k]
      const dp = (n * (z * p1 - p0)) / (z * z - 1)
      const dz = p1 / dp
      z -= dz
      if (Math.abs(dz) < 1e-15) {
        w[i] = 2 / ((1 - z * z) * dp * dp)
        break
      }
    }
    x[i] = z
  }
  return { x, w }
}

/**
 * Orthonormal Legendre polynomials q_0..q_{n−1} and their first two
 * derivatives at x: q_i = √((2i+1)/2) P_i.
 */
export function legendre(n: number, x: number): { q: Float64Array; d1: Float64Array; d2: Float64Array } {
  const p = new Float64Array(n)
  const d1 = new Float64Array(n)
  const d2 = new Float64Array(n)
  // P and its derivatives by recurrence: P_k = ((2k−1) x P_{k−1} − (k−1) P_{k−2}) / k,
  // P'_k = P'_{k−2} + (2k−1) P_{k−1}, P''_k = P''_{k−2} + (2k−1) P'_{k−1}.
  for (let k = 0; k < n; k++) {
    if (k === 0) {
      p[0] = 1
    } else if (k === 1) {
      p[1] = x
      d1[1] = 1
    } else {
      p[k] = ((2 * k - 1) * x * p[k - 1]! - (k - 1) * p[k - 2]!) / k
      d1[k] = d1[k - 2]! + (2 * k - 1) * p[k - 1]!
      d2[k] = d2[k - 2]! + (2 * k - 1) * d1[k - 1]!
    }
  }
  const q = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const s = Math.sqrt((2 * k + 1) / 2)
    q[k] = p[k]! * s
    d1[k] = d1[k]! * s
    d2[k] = d2[k]! * s
  }
  return { q, d1, d2 }
}

/** Symmetry of a square-plate mode about the centre lines x = 0, y = 0 and the diagonal y = x. */
export type SquareSymmetry = {
  /** 'S' symmetric or 'A' antisymmetric about x = 0 (the parity of the polynomials in x). */
  x: 'S' | 'A'
  y: 'S' | 'A'
  /** About the diagonal y = x, for modes that are not part of a degenerate pair; '-' otherwise. */
  diagonal: 'S' | 'A' | '-'
}

export type SquareMode = {
  plate: 'square'
  /** Frequency parameter Ω = ω a² √(ρh/D), a the side length. */
  omega: number
  symmetry: SquareSymmetry
  /** Ritz coefficients c[i * terms + j] of q_i(x) q_j(y). */
  coefficients: Float64Array
  terms: number
}

export type SquareOptions = {
  /** Poisson's ratio. Default 0.3. */
  nu?: number
  /** Polynomials per direction. Default 16 (256 trial functions). */
  terms?: number
}

/**
 * The modes of the free square plate, rigid-body motions left out, sorted by
 * frequency. With 16 terms per direction the first 30 or so are converged to
 * better than 0.1%.
 */
export function squareModes({ nu = 0.3, terms = 16 }: SquareOptions = {}): SquareMode[] {
  const N = terms
  // 1D integrals of products of q, q', q'' (exact for polynomials of this degree).
  const g = gaussLegendre(N + 2)
  const A0 = new Float64Array(N * N)
  const A1 = new Float64Array(N * N)
  const A2 = new Float64Array(N * N)
  const B = new Float64Array(N * N) // B[i,k] = ∫ q_i'' q_k
  for (let s = 0; s < g.x.length; s++) {
    const { q, d1, d2 } = legendre(N, g.x[s]!)
    const ws = g.w[s]!
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < N; k++) {
        A0[i * N + k]! += ws * q[i]! * q[k]!
        A1[i * N + k]! += ws * d1[i]! * d1[k]!
        A2[i * N + k]! += ws * d2[i]! * d2[k]!
        B[i * N + k]! += ws * d2[i]! * q[k]!
      }
    }
  }
  const at = (m: Float64Array, i: number, k: number) => m[i * N + k]!

  const modes: SquareMode[] = []
  for (const px of [0, 1]) {
    for (const py of [0, 1]) {
      const basis: [number, number][] = []
      for (let i = px; i < N; i += 2) for (let j = py; j < N; j += 2) basis.push([i, j])
      const n = basis.length
      const K = matrix(n)
      for (let r = 0; r < n; r++) {
        const [i, j] = basis[r]!
        for (let c = r; c < n; c++) {
          const [k, l] = basis[c]!
          const v =
            at(A2, i, k) * at(A0, j, l) +
            at(A0, i, k) * at(A2, j, l) +
            nu * (at(B, i, k) * at(B, l, j) + at(B, k, i) * at(B, j, l)) +
            2 * (1 - nu) * at(A1, i, k) * at(A1, j, l)
          K.a[r * n + c] = v
          K.a[c * n + r] = v
        }
      }
      const { values, vectors } = symmetricEigen(K)
      values.forEach((mu, m) => {
        const omega = 4 * Math.sqrt(Math.max(0, mu))
        // Rigid-body motions (translation, two tilts) have Ω ≈ 0.
        if (omega < 1) return
        const coefficients = new Float64Array(N * N)
        basis.forEach(([i, j], b) => (coefficients[i * N + j] = vectors[m]![b]!))
        let diagonal: SquareSymmetry['diagonal'] = '-'
        if (px === py) {
          let sym = 0
          let anti = 0
          for (let i = 0; i < N; i++)
            for (let j = 0; j < N; j++) {
              sym += Math.abs(coefficients[i * N + j]! - coefficients[j * N + i]!)
              anti += Math.abs(coefficients[i * N + j]! + coefficients[j * N + i]!)
            }
          diagonal = sym < anti ? 'S' : 'A'
        }
        modes.push({
          plate: 'square',
          omega,
          symmetry: { x: px ? 'A' : 'S', y: py ? 'A' : 'S', diagonal },
          coefficients,
          terms: N,
        })
      })
    }
  }
  return modes.sort((a, b) => a.omega - b.omega)
}

/** Deflection of a square-plate mode at (x, y), −1 ≤ x, y ≤ 1. */
export function squareModeAt(mode: SquareMode, x: number, y: number): number {
  const N = mode.terms
  const qx = legendre(N, x).q
  const qy = legendre(N, y).q
  let w = 0
  for (let i = 0; i < N; i++) {
    const qi = qx[i]!
    if (qi === 0) continue
    for (let j = 0; j < N; j++) w += mode.coefficients[i * N + j]! * qi * qy[j]!
  }
  return w
}

/**
 * The classical approximation (Leissa 1969, eq. 4.70, after Waller):
 * free-membrane modes cos(mπx′) cos(nπy′) ± cos(nπx′) cos(mπy′), with x′, y′ in
 * [0, 1]. Quick and pretty, but not a solution of the plate equation: its
 * nodal lines are close to a real plate's only for some (m, n).
 */
export function membraneModeAt(m: number, n: number, sign: 1 | -1, x: number, y: number): number {
  const u = (x + 1) / 2
  const v = (y + 1) / 2
  return Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) + sign * Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v)
}
