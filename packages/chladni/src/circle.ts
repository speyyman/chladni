/**
 * Free vibration of a thin circular plate with a free edge. Kirchhoff plate
 * theory has exact solutions here: in polar coordinates (r, θ), radius 1,
 *
 *   w = [J_n(λr) + C I_n(λr)] cos nθ,
 *
 * where J_n and I_n are Bessel and modified Bessel functions. A free edge
 * carries no bending moment and no effective shear force:
 *
 *   M_r ∝ w_rr + ν (w_r / r + w_θθ / r²) = 0
 *   V_r ∝ ∂(∇²w)/∂r + (1 − ν) (1/r²) ∂²/∂θ² (w_r − w / r) = 0   at r = 1.
 *
 * These two equations in the two unknowns (1, C) have a solution only when
 * their determinant vanishes, which fixes λ. Leissa's frequency parameter is
 * Ω = ω a² √(ρh/D) = λ², a the radius. A mode has n nodal diameters and s
 * nodal circles.
 *
 * Reference: A. W. Leissa, Vibration of Plates, NASA SP-160 (1969), section
 * 2.1.3 and tables 2.5 and 2.7, which the tests compare against.
 */
import { besselI, besselIPrime, besselJ, besselJPrime } from './bessel.js'

export type CircleMode = {
  plate: 'circle'
  /** Nodal diameters. */
  n: number
  /** Nodal circles. */
  s: number
  /** λ, the root of the frequency equation. */
  lambda: number
  /** Frequency parameter Ω = ω a² √(ρh/D) = λ², a the radius. */
  omega: number
  /** w = J_n(λr) + C I_n(λr). */
  C: number
  /** Scale that makes ∫∫ w² dA = 1 over the unit disc. */
  norm: number
}

/** Moment and shear conditions at r = 1 for J_n(λr) and I_n(λr). */
function edge(n: number, lam: number, nu: number) {
  const J = besselJ(n, lam)
  const Jp = besselJPrime(n, lam)
  const I = besselI(n, lam)
  const Ip = besselIPrime(n, lam)
  const n2 = n * n
  const l2 = lam * lam
  // Using Bessel's equations to remove second derivatives (see the module comment).
  const mJ = -l2 * J + (1 - nu) * (n2 * J - lam * Jp)
  const mI = l2 * I + (1 - nu) * (n2 * I - lam * Ip)
  const vJ = -l2 * lam * Jp - (1 - nu) * n2 * (lam * Jp - J)
  const vI = l2 * lam * Ip - (1 - nu) * n2 * (lam * Ip - I)
  return { mJ, mI, vJ, vI }
}

/** The frequency determinant, scaled by I_n(λ) so it stays of order one. */
function determinant(n: number, lam: number, nu: number) {
  const e = edge(n, lam, nu)
  return (e.mJ * e.vI - e.mI * e.vJ) / besselI(n, lam) ** 2
}

/** J_n(λr) + C I_n(λr). */
export const circleRadial = (mode: CircleMode, r: number) => besselJ(mode.n, mode.lambda * r) + mode.C * besselI(mode.n, mode.lambda * r)

export type CircleOptions = {
  /** Poisson's ratio. Default 0.3. */
  nu?: number
  /** Largest number of nodal diameters. Default 8. */
  maxN?: number
  /** Largest λ searched. Default 16 (Ω up to 256). */
  maxLambda?: number
}

/** Modes of the free circular plate, rigid-body motions left out, sorted by frequency. */
export function circleModes({ nu = 0.3, maxN = 8, maxLambda = 16 }: CircleOptions = {}): CircleMode[] {
  const modes: CircleMode[] = []
  for (let n = 0; n <= maxN; n++) {
    // Roots are at least ~0.5 apart in λ, so this step cannot jump over a pair.
    const step = 0.02
    let prev = determinant(n, 0.3, nu)
    for (let lam = 0.3 + step; lam <= maxLambda; lam += step) {
      const cur = determinant(n, lam, nu)
      if (Math.sign(cur) !== Math.sign(prev)) {
        // Bisection to full precision.
        let a = lam - step
        let b = lam
        let fa = prev
        for (let it = 0; it < 60; it++) {
          const m = (a + b) / 2
          const fm = determinant(n, m, nu)
          if (Math.sign(fm) === Math.sign(fa)) {
            a = m
            fa = fm
          } else b = m
        }
        const root = (a + b) / 2
        const e = edge(n, root, nu)
        const mode: CircleMode = { plate: 'circle', n, s: 0, lambda: root, omega: root * root, C: -e.mJ / e.mI, norm: 1 }
        // Count nodal circles: sign changes of the radial function inside the plate.
        const count = nodalCircles(mode).length
        mode.s = count
        // Normalise: ∫∫ w² dA = ∫₀¹ R² r dr ∫ cos² nθ dθ, the angular part π (2π when n = 0).
        let integral = 0
        const K = 400
        for (let k = 0; k < K; k++) {
          const r = (k + 0.5) / K
          integral += circleRadial(mode, r) ** 2 * r
        }
        integral *= (1 / K) * (n === 0 ? 2 * Math.PI : Math.PI)
        mode.norm = 1 / Math.sqrt(integral)
        modes.push(mode)
      }
      prev = cur
    }
  }
  return modes.sort((a, b) => a.omega - b.omega)
}

/** Deflection of a circular-plate mode at (x, y) on the unit disc; 0 outside it. */
export function circleModeAt(mode: CircleMode, x: number, y: number): number {
  const r = Math.hypot(x, y)
  if (r > 1) return 0
  return mode.norm * circleRadial(mode, r) * Math.cos(mode.n * Math.atan2(y, x))
}

/**
 * Radii of the nodal circles of a mode, inner first. Near the centre a mode
 * with n nodal diameters grows like rⁿ, so values below a millionth of the
 * largest are treated as zero rather than as sign changes.
 */
export function nodalCircles(mode: CircleMode): number[] {
  const f = (r: number) => circleRadial(mode, r)
  const K = 1000
  const samples = Array.from({ length: K + 1 }, (_, k) => f(k / K))
  const floor = 1e-6 * Math.max(...samples.map(Math.abs))
  const out: number[] = []
  let lastSign = 0
  let lastR = 0
  for (let k = 0; k <= K; k++) {
    const v = samples[k]!
    if (Math.abs(v) <= floor) continue
    const sign = Math.sign(v)
    if (lastSign && sign !== lastSign) {
      let lo = lastR
      let hi = k / K
      const slo = lastSign
      for (let it = 0; it < 50; it++) {
        const m = (lo + hi) / 2
        if (Math.sign(f(m)) === slo) lo = m
        else hi = m
      }
      out.push((lo + hi) / 2)
    }
    lastSign = sign
    lastR = k / K
  }
  return out
}
