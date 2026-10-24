/**
 * Bessel functions of integer order for real arguments, from their integral
 * representations. The integrands are smooth and periodic, so the trapezoid
 * rule converges exponentially; the number of nodes grows with the argument.
 *
 *   J_n(x) = (1/π) ∫₀^π cos(nτ − x sin τ) dτ
 *   I_n(x) = (1/π) ∫₀^π e^{x cos τ} cos(nτ) dτ
 *
 * Accurate to about 1e-12 relative for |x| ≤ 60 and n ≤ 30, which covers every
 * plate mode this library draws.
 */

const nodesFor = (n: number, x: number) => 32 + 2 * Math.ceil(Math.abs(x) + n)

/** Bessel function of the first kind, J_n(x). */
export function besselJ(n: number, x: number): number {
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

/** Modified Bessel function of the first kind, I_n(x). */
export function besselI(n: number, x: number): number {
  const m = nodesFor(n, x)
  const h = Math.PI / m
  let s = 0
  for (let k = 0; k <= m; k++) {
    const t = k * h
    const f = Math.exp(x * Math.cos(t)) * Math.cos(n * t)
    s += k === 0 || k === m ? f / 2 : f
  }
  return (s * h) / Math.PI
}

/** dJ_n/dx, from J_n' = (J_{n−1} − J_{n+1}) / 2 (with J_{−1} = −J_1). */
export const besselJPrime = (n: number, x: number): number => (n === 0 ? -besselJ(1, x) : (besselJ(n - 1, x) - besselJ(n + 1, x)) / 2)

/** dI_n/dx, from I_n' = (I_{n−1} + I_{n+1}) / 2 (with I_{−1} = I_1). */
export const besselIPrime = (n: number, x: number): number => (n === 0 ? besselI(1, x) : (besselI(n - 1, x) + besselI(n + 1, x)) / 2)
