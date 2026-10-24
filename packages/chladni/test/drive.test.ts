import { describe, expect, it } from 'vitest'
import { DEMO_SQUARE, hertz, omegaFor } from '../src/plate.js'
import { drive, preparePlate, referenceAcceleration } from '../src/drive.js'
import { Sand } from '../src/sand.js'
import { squareModes } from '../src/square.js'

const size = 96
const plate = preparePlate(squareModes({ terms: 12 }).slice(0, 12), size)
const at = { x: 0.83, y: 0.31 }

const correlation = (a: Float32Array, b: Float32Array) => {
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    ab += a[i]! * b[i]!
    aa += a[i]! * a[i]!
    bb += b[i]! * b[i]!
  }
  return ab / Math.sqrt(aa * bb)
}

describe('driven plate', () => {
  it('takes the shape of a mode at its resonance', () => {
    for (const k of [0, 1, 2, 7]) {
      const r = drive(plate, plate.modes[k]!.omega, { at })
      expect(r.dominant).toBe(k)
      expect(Math.abs(correlation(r.im, plate.fields[k]!.values))).toBeGreaterThan(0.99)
    }
  })

  it('moves far less between resonances', () => {
    const peak = (o: number) => Math.max(...drive(plate, o, { at }).amplitude.values)
    const mid = (plate.modes[1]!.omega + plate.modes[2]!.omega) / 2
    expect(peak(mid)).toBeLessThan(peak(plate.modes[1]!.omega) / 20)
  })
})

describe('sand', () => {
  const ref = referenceAcceleration(plate, { at })

  it('gathers on the nodal lines at a resonance', () => {
    for (const k of [3, 11]) {
      const r = drive(plate, plate.modes[k]!.omega, { at })
      const peak = Math.max(...r.acceleration.values)
      const sand = new Sand({ count: 3000, seed: 7 })
      const before = sand.meanUnder(r.acceleration, peak)
      for (let i = 0; i < 400; i++) sand.step(r.acceleration, { scale: ref })
      const after = sand.meanUnder(r.acceleration, peak)
      // Spread evenly, grains sit on a fifth to a third of the peak acceleration; on the lines, almost none.
      expect(before).toBeGreaterThan(0.15)
      expect(after).toBeLessThan(before / 3)
      expect(after).toBeLessThan(0.08)
      for (let i = 0; i < sand.count; i++) {
        expect(Math.abs(sand.x[i]!)).toBeLessThanOrEqual(1)
        expect(Math.abs(sand.y[i]!)).toBeLessThanOrEqual(1)
      }
    }
  }, 30000)

  it('does not move when the plate is driven between resonances', () => {
    const off = drive(plate, (plate.modes[1]!.omega + plate.modes[2]!.omega) / 2, { at })
    const sand = new Sand({ count: 2000, seed: 1 })
    expect(sand.step(off.acceleration, { scale: ref })).toBe(0)
  })

  it('is repeatable from its seed and stays on a disc', () => {
    const a = new Sand({ count: 500, seed: 9, plate: 'circle' })
    const b = new Sand({ count: 500, seed: 9, plate: 'circle' })
    expect(a.x).toEqual(b.x)
    const flat = { size: 4, values: new Float32Array(16).fill(1) }
    for (let i = 0; i < 50; i++) {
      a.step(flat, { scale: 1 })
      b.step(flat, { scale: 1 })
    }
    expect(a.x).toEqual(b.x)
    for (let i = 0; i < a.count; i++) expect(Math.hypot(a.x[i]!, a.y[i]!)).toBeLessThanOrEqual(1 + 1e-6)
  })
})

describe('physical frequency', () => {
  it('converts both ways and puts the demo square’s fundamental near 57 Hz', () => {
    const f = hertz(13.468, DEMO_SQUARE)
    expect(f).toBeGreaterThan(56)
    expect(f).toBeLessThan(58)
    expect(omegaFor(f, DEMO_SQUARE)).toBeCloseTo(13.468, 10)
  })
})

describe('sand on the true nodal lines', () => {
  it('gathers within 0.03 of the exact nodal lines of the twisting mode (the centre lines)', () => {
    // The lowest mode is antisymmetric about both centre lines, so its nodal lines are exactly x = 0 and y = 0.
    const r = drive(plate, plate.modes[0]!.omega, { at })
    const ref = referenceAcceleration(plate, { at })
    const sand = new Sand({ count: 4000, seed: 3 })
    for (let i = 0; i < 600; i++) sand.step(r.acceleration, { scale: ref })
    let near = 0
    for (let i = 0; i < sand.count; i++) if (Math.min(Math.abs(sand.x[i]!), Math.abs(sand.y[i]!)) < 0.03) near++
    // The band covers about 6% of the plate, so this is a strong concentration.
    expect(near / sand.count).toBeGreaterThan(0.6)
  }, 30000)

  it('gathers on both diagonals for the saddle mode', () => {
    const r = drive(plate, plate.modes[1]!.omega, { at })
    const ref = referenceAcceleration(plate, { at })
    const sand = new Sand({ count: 4000, seed: 3 })
    for (let i = 0; i < 600; i++) sand.step(r.acceleration, { scale: ref })
    let near = 0
    for (let i = 0; i < sand.count; i++) if (Math.abs(Math.abs(sand.x[i]!) - Math.abs(sand.y[i]!)) / Math.SQRT2 < 0.03) near++
    expect(near / sand.count).toBeGreaterThan(0.6)
  }, 30000)
})
