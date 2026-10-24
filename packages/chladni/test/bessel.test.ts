import { describe, expect, it } from 'vitest'
import { besselI, besselIPrime, besselJ, besselJPrime } from '../src/bessel.js'
import { symmetricEigen, matrix } from '../src/linalg.js'

// Reference values: Abramowitz and Stegun, Handbook of Mathematical Functions, tables 9.1, 9.5, 9.8.
describe('Bessel functions', () => {
  it('match tabulated values', () => {
    expect(besselJ(0, 1)).toBeCloseTo(0.7651976865579666, 13)
    expect(besselJ(1, 1)).toBeCloseTo(0.4400505857449335, 13)
    expect(besselJ(2, 5)).toBeCloseTo(0.04656511627775222, 13)
    expect(besselI(0, 1)).toBeCloseTo(1.2660658777520084, 12)
    expect(besselI(1, 1)).toBeCloseTo(0.5651591039924851, 12)
  })

  it('vanish at the first zeros of J0 and J1', () => {
    expect(Math.abs(besselJ(0, 2.404825557695773))).toBeLessThan(1e-13)
    expect(Math.abs(besselJ(1, 3.831705970207512))).toBeLessThan(1e-13)
  })

  it('have derivatives that agree with finite differences', () => {
    const h = 1e-5
    for (const n of [0, 1, 3, 6])
      for (const x of [0.7, 4.2, 11.5]) {
        expect(besselJPrime(n, x)).toBeCloseTo((besselJ(n, x + h) - besselJ(n, x - h)) / (2 * h), 8)
        expect(besselIPrime(n, x)).toBeCloseTo((besselI(n, x + h) - besselI(n, x - h)) / (2 * h) / 1, 4)
      }
  })

  it('satisfy the recurrence J_{n−1} + J_{n+1} = (2n/x) J_n', () => {
    for (const n of [1, 4, 9])
      for (const x of [2.5, 13]) expect(besselJ(n - 1, x) + besselJ(n + 1, x)).toBeCloseTo(((2 * n) / x) * besselJ(n, x), 12)
  })
})

describe('symmetric eigenproblem', () => {
  it('returns orthonormal eigenvectors with A v = λ v', () => {
    const n = 12
    const A = matrix(n)
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
    for (let i = 0; i < n; i++)
      for (let j = i; j < n; j++) {
        const v = rand()
        A.a[i * n + j] = v
        A.a[j * n + i] = v
      }
    const { values, vectors } = symmetricEigen(A)
    for (let k = 0; k < n; k++) {
      if (k) expect(values[k]).toBeGreaterThanOrEqual(values[k - 1]!)
      for (let i = 0; i < n; i++) {
        let av = 0
        for (let j = 0; j < n; j++) av += A.a[i * n + j]! * vectors[k]![j]!
        expect(av).toBeCloseTo(values[k]! * vectors[k]![i]!, 10)
      }
      for (let l = 0; l < n; l++) {
        let dot = 0
        for (let i = 0; i < n; i++) dot += vectors[k]![i]! * vectors[l]![i]!
        expect(dot).toBeCloseTo(k === l ? 1 : 0, 10)
      }
    }
  })
})
