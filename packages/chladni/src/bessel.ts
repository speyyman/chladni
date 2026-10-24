/**
 * Bessel functions of integer order for real arguments x ≥ 0.
 *
 * Where J_n is small (small x, or order above the argument) it comes from its
 * power series, which keeps full relative accuracy there:
 *
 *   J_n(x) = Σ (−1)^k (x/2)^{2k+n} / (k! (k+n)!)
 *
 * Elsewhere it comes from Bessel's integral, whose integrand is smooth and
 * periodic, so the trapezoid rule converges exponentially:
 *
 *   J_n(x) = (1/π) ∫₀^π cos(nτ − x sin τ) dτ
 *
 * I_n always comes from its series, whose terms are all positive:
 *
 *   I_n(x) = Σ (x/2)^{2k+n} / (k! (k+n)!)
 *
 * Accurate to about 1e-12 relative for 0 ≤ x ≤ 40 and n ≤ 30, which covers
 * every plate mode this library draws (tested against mpmath).
 */

const nodesFor = (n: number, x: number) => 32 + 2 * Math.ceil(Math.abs(x) + n)

/** (x/2)^n / n!, the first term of both series, by logs so large n does not overflow. */
const lead = (n: number, x: number) => {
  let lg = n * Math.log(x / 2)
  for (let k = 2; k <= n; k++) lg -= Math.log(k)
  return Math.exp(lg)
}

function series(n: number, x: number, sign: 1 | -1): number {
  if (x === 0) return n === 0 ? 1 : 0
  const q = (x * x) / 4
  let term = lead(n, x)
  let sum = term
  for (let k = 1; k < 200; k++) {
    term *= (sign * q) / (k * (k + n))
    sum += term
    if (Math.abs(term) < 1e-17 * Math.abs(sum)) break
  }
  return sum
}

/** Bessel function of the first kind, J_n(x), x ≥ 0. */
export function besselJ(n: number, x: number): number {
  if (x < 12 || n > x) return series(n, x, -1)
  const m = nodesFor(n, x)
  const h = Math.PI / m
  let s = 0
  for (let k = 0; k <= m; k++) {
    const t = k * h
    const f = Math.cos(n * t - x * Math.sin(t))
    s += k === 0 || k === m ? f / 2 : f
  }
  return (s * h) / Math.PI
}

/** Modified Bessel function of the first kind, I_n(x), x ≥ 0. */
export const besselI = (n: number, x: number): number => series(n, x, 1)

/** dJ_n/dx, from J_n' = (J_{n−1} − J_{n+1}) / 2 (with J_{−1} = −J_1). */
export const besselJPrime = (n: number, x: number): number => (n === 0 ? -besselJ(1, x) : (besselJ(n - 1, x) - besselJ(n + 1, x)) / 2)

/** dI_n/dx, from I_n' = (I_{n−1} + I_{n+1}) / 2 (with I_{−1} = I_1). */
export const besselIPrime = (n: number, x: number): number => (n === 0 ? besselI(1, x) : (besselI(n - 1, x) + besselI(n + 1, x)) / 2)
