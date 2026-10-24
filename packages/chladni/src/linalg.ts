/**
 * Eigenvalues and eigenvectors of a real symmetric matrix by the cyclic Jacobi
 * method: slow for big matrices, but simple, robust and accurate, and the
 * plate problems here split into blocks of at most a few dozen rows.
 */

/** A dense square matrix, row-major. */
export type Matrix = { n: number; a: Float64Array }

export const matrix = (n: number): Matrix => ({ n, a: new Float64Array(n * n) })

export type Eigen = {
  /** Eigenvalues in ascending order. */
  values: number[]
  /** vectors[k] is the unit eigenvector for values[k]. */
  vectors: Float64Array[]
}

export function symmetricEigen(m: Matrix, { tolerance = 1e-13, maxSweeps = 100 } = {}): Eigen {
  const n = m.n
  const a = Float64Array.from(m.a)
  const v = new Float64Array(n * n)
  for (let i = 0; i < n; i++) v[i * n + i] = 1
  const off = () => {
    let s = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += a[i * n + j]! ** 2
    return s
  }
  let scale = 0
  for (let i = 0; i < n * n; i++) scale += a[i]! ** 2
  for (let sweep = 0; sweep < maxSweeps && off() > tolerance * tolerance * scale; sweep++) {
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q]!
        if (Math.abs(apq) < 1e-300) continue
        const app = a[p * n + p]!
        const aqq = a[q * n + q]!
        const theta = (aqq - app) / (2 * apq)
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p]!
          const akq = a[k * n + q]!
          a[k * n + p] = c * akp - s * akq
          a[k * n + q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k]!
          const aqk = a[q * n + k]!
          a[p * n + k] = c * apk - s * aqk
          a[q * n + k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p]!
          const vkq = v[k * n + q]!
          v[k * n + p] = c * vkp - s * vkq
          v[k * n + q] = s * vkp + c * vkq
        }
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i * n + i]! - a[j * n + j]!)
  return {
    values: order.map((i) => a[i * n + i]!),
    vectors: order.map((i) => {
      const col = new Float64Array(n)
      for (let k = 0; k < n; k++) col[k] = v[k * n + i]!
      return col
    }),
  }
}
